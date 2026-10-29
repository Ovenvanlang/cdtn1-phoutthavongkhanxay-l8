// Lớp service: quản lý tài khoản app_user (CRUD) – chỉ Ban giám đốc dùng (TD-21).
// Quy tắc nghiệp vụ:
//   QT-14  Tài khoản Quản lý trung tâm BẮT BUỘC gắn với đúng một trung tâm đang có;
//          các vai trò khác xem toàn hệ thống nên KHÔNG gắn trung tâm.
//   QT-13  Không xóa vật lý: "xóa" = khóa tài khoản (is_active = 0), lịch sử vẫn giữ.
//   TK-01  Tên đăng nhập là duy nhất.
//   TK-02  Không tự khóa hay tự hạ quyền tài khoản của chính mình.
//   TK-03  Luôn còn ít nhất một tài khoản Ban giám đốc đang hoạt động.
// Không chứa SQL, không biết gì về HTTP. Mật khẩu chỉ lưu dạng băm, không bao giờ trả ra ngoài.
const E = require('../errors/AppError');
const { hashPassword } = require('../utils/password');

function createUserService({ userRepo, centerRepo }) {
  /** QT-14: kiểm tra cặp (vai trò, trung tâm) sau khi đã gộp giá trị cũ và mới. */
  function checkCenterForRole(role, centerId) {
    if (role === 'quan_ly') {
      if (centerId == null) throw E.invalid('Tài khoản Quản lý trung tâm phải gắn với một trung tâm (QT-14)', 'center_id');
      if (!centerRepo.findById(centerId)) throw E.invalid('Không có trung tâm này', 'center_id');
    } else if (centerId != null) {
      throw E.invalid('Chỉ tài khoản Quản lý trung tâm mới gắn trung tâm; vai trò khác xem toàn hệ thống (QT-14)', 'center_id');
    }
  }

  function getOrThrow(userId) {
    const user = userRepo.findById(userId);
    if (!user) throw E.notFound('Không có tài khoản này');
    return user;
  }

  /** TK-03: thao tác làm mất quyền BGĐ của tài khoản BGĐ đang hoạt động cuối cùng thì bị chặn. */
  function checkLastDirector(user, finalRole, finalActive) {
    const losesDirector = user.role === 'bgd' && user.is_active && (finalRole !== 'bgd' || !finalActive);
    if (losesDirector && userRepo.countActiveByRole('bgd') <= 1) throw E.lastDirector();
  }

  return {
    list(filters) {
      const { role = null, centerId = null, isActive = null, page = 1, limit = 20 } = filters;
      const { rows, total } = userRepo.list({ role, centerId, isActive, limit, offset: (page - 1) * limit });
      return { data: rows, meta: { page, limit, total } };
    },

    get(userId) {
      return getOrThrow(userId);
    },

    create({ username, password, fullName, role, centerId }) {
      checkCenterForRole(role, centerId);                                  // QT-14
      if (userRepo.findByUsername(username)) throw E.usernameTaken();     // TK-01
      let userId;
      try {
        userId = userRepo.insert({ username, passwordHash: hashPassword(password), fullName, role, centerId });
      } catch (err) {                                                      // hai yêu cầu đồng thời: UNIQUE chặn
        if (/UNIQUE/i.test(err.message)) throw E.usernameTaken();
        throw err;
      }
      return getOrThrow(userId);
    },

    /** @param {{userId:number}} actor người đang thao tác (lấy từ token) */
    update(actor, userId, changes) {
      const user = getOrThrow(userId);
      const finalRole = changes.role ?? user.role;
      const finalActive = changes.isActive ?? user.is_active;
      // Đổi vai trò mà không gửi center_id: rời vai trò quản lý thì bỏ trung tâm, còn lại giữ trung tâm cũ
      let finalCenter = 'centerId' in changes ? changes.centerId : user.center_id;
      if (!('centerId' in changes) && finalRole !== 'quan_ly') finalCenter = null;

      if (actor.userId === userId && (finalRole !== user.role || !finalActive))
        throw E.selfAction('Không được tự đổi vai trò hoặc tự khóa tài khoản của chính mình');  // TK-02
      checkCenterForRole(finalRole, finalCenter);                                               // QT-14
      checkLastDirector(user, finalRole, finalActive);                                          // TK-03

      const patch = {};
      if (changes.fullName !== undefined) patch.fullName = changes.fullName;
      if (finalRole !== user.role) patch.role = finalRole;
      if (finalCenter !== user.center_id) patch.centerId = finalCenter;
      if (changes.password !== undefined) patch.passwordHash = hashPassword(changes.password);
      if (finalActive !== user.is_active) patch.isActive = finalActive;
      userRepo.update(userId, patch);
      return getOrThrow(userId);
    },

    /** Xóa MỀM (QT-13): khóa tài khoản, không xóa dòng. Tài khoản bị khóa không đăng nhập được. */
    deactivate(actor, userId) {
      const user = this.update(actor, userId, { isActive: false });
      return { user_id: user.user_id, is_active: user.is_active };
    },
  };
}

module.exports = { createUserService };
