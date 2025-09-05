const BaseRoute = require("./_base.route");
const authController = require("../controllers/auth.controller");
const { auth } = require("../middleware/auth");
const {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
} = require("../validations/auth.validation");

class AuthRoute extends BaseRoute {
  constructor(app) {
    super(app);
  }

  load() {
    // Public routes
    this.app.post(
      "/api/auth/register",
      registerValidation,
      authController.register
    );

    this.app.post("/api/auth/login", loginValidation, authController.login);

    // Protected routes
    this.app.get("/api/auth/profile", auth, authController.getProfile);

    this.app.put(
      "/api/auth/profile",
      auth,
      updateProfileValidation,
      authController.updateProfile
    );

    this.app.put(
      "/api/auth/change-password",
      auth,
      changePasswordValidation,
      authController.changePassword
    );
  }
}

module.exports = AuthRoute;
