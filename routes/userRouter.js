const express=require("express");
const passport = require("passport");
const router=express.Router();
const userController=require("../controllers/user/userControllers");
const {userAuth,adminAuth}=require('../middlewares/auth');
const productController = require('../controllers/user/productController');



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
  

router.get("/login",userController.loadLogin);
router.post("/login",userController.login);

router.get("/logout",userAuth,userController.logout);















module.exports=router;



