const express=require("express");
const passport = require("passport");
const router=express.Router();
const userController=require("../controllers/user/userControllers");
const {userAuth,adminAuth}=require('../middlewares/auth');
const productController = require('../controllers/user/productController');
const profileController = require('../controllers/user/profileController');
const cartController = require('../controllers/user/cartController');

router.get("/pageNotFound",userController.pageNotFound);
//homepage & shop
router.get("/",userController.loadHomepage);
router.get("/shop",userAuth,userController.loadShoppingPage);
router.get("/filter",userController.filterProduct);
router.get("/filterPrice",userController.filterByPrice);
router.get("/search",userController.searchProducts);

router.get('/productDetails/:id',productController.productDetails)

//signup
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.Signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);


router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}));


router.get("/auth/google/callback", 
    passport.authenticate('google', {
      failureRedirect: "/login?message=User is blocked by admin",
    }), 
    (req, res) => {
      req.session.user = req.user;  
      res.redirect('/');
    }
  );
  
//login
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);

//logout
router.get("/logout",userAuth,userController.logout);

//profile
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);
router.get("/userProfile",userAuth,profileController.userProfile);
router.post("/edit-profile", userAuth, profileController.editProfile);
router.post("/update-password", userAuth, profileController.updatePassword);

//address
router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress);
router.post("/editAddress", userAuth, profileController.postEditAddress);
router.get("/deleteAddress", userAuth, profileController.deleteAddress);


//cart
router.get("/cart", userAuth,cartController.loadCart);
router.post("/add-to-cart",userAuth,cartController.addToCart);
router.post("/update-cart",userAuth,cartController.updateCart);
// router.delete("/remove-cart-item",userAuth,cartController.removeFromCart);


module.exports=router;



