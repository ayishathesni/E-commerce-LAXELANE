const express=require("express");
const passport = require("passport");
const router=express.Router();
const userController=require("../controllers/user/userControllers");
const {userAuth,adminAuth}=require('../middlewares/auth');
const productController = require('../controllers/user/productController');
const profileController = require('../controllers/user/profileController');
const cartController = require('../controllers/user/cartController');
const checkoutController = require('../controllers/user/checkoutController');
const orderController = require('../controllers/user/orderController');



router.get("/pageNotFound",userController.pageNotFound);
//homepage & shop
router.get("/",userController.loadHomepage);
router.get("/shop",userAuth,userController.loadShoppingPage);
router.get("/filter",userController.filterProduct);
router.get('/filter-price', userController.filterByPrice);
router.get('/filter-category', userController.filterByCategory);
router.get('/filter-color', userController.filterByColor);
router.get('/apply-filters', userController.applyFilters);
router.get('/clear-filters', userController.clearFilters);
router.get("/search",userController.searchProducts);
// router.get("/search",userController.searchP);

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
router.delete("/deleteAddress", userAuth, profileController.deleteAddress);



//cart
router.get("/cart", userAuth,cartController.loadCart);
router.post("/add-to-cart",userAuth,cartController.addToCart);
router.post("/cartUpdate", userAuth, cartController.cartUpdate); 
router.delete("/deleteCart", userAuth, cartController.deleteCart);

//checkout
router.get("/checkout", userAuth, checkoutController.loadCheckout);
router.post("/verify-checkout-address", userAuth, checkoutController.verifyCheckOutAddress);
router.post("/edit-address-checkout", userAuth, checkoutController.editAddressCheckout);
router.post("/add-address-checkout", userAuth, checkoutController.addAddressCheckout);
router.patch("/chooseAddress/:id", checkoutController.chooseAddress);
router.post("/place-order", userAuth, checkoutController.placeOrder);
router.get("/order-success", userAuth, checkoutController.loadThanks);

//order
router.get('/orders', userAuth, orderController.loadOrder);
router.get('/orders/:orderId', userAuth, orderController.viewOrderDetails);
router.delete('/cancel-single-order/:orderId', userAuth, orderController.cancelSingleProduct);
router.delete('/cancel-order', userAuth, orderController.cancelOrder);
router.post("/request-Product-Return/:orderId", userAuth, orderController.productReturn)
router.get('/download-invoice',userAuth,orderController.downloadInvoice);

module.exports=router;



