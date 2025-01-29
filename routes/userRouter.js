const express=require("express");
const router=express.Router();
const userController=require("../controllers/user/userControllers");





router.get("/pageNotFound",userController.pageNotFound);
router.get("/",userController.loadHomepage);
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.Signup);
// router.get("/login",userController.loadLogin);
// router.post("/login",userController.Login);














module.exports=router;



