const express = require('express');
const router = express.Router();
const adminController=require("../controllers/admin/adminController");
const customerController=require("../controllers/admin/customerController");
const categoryController=require("../controllers/admin/categoryController");
const {userAuth,adminAuth}=require("../middlewares/auth");
const productController=require("../controllers/admin/productController");
const multer = require('multer')
const storage = require('../helpers/multer')
const uploads = multer({storage:storage})
const orderController=require("../controllers/admin/orderController");
const couponController=require("../controllers/admin/couponController");




router.post("/pageerror",adminController.pageerror);

router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
// router.get("/dashboard",adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);
router.get('/dashboard', adminAuth, adminController.loadDashboard);
router.get('/dashboard/analytics', adminAuth, adminController.getAnalyticsData);
router.get('/dashboard/top-performers',adminAuth, adminController.getTopPerformers);
router.get('/sales-report', adminAuth, adminController.generateSalesReport);
router.get('/download/excel', adminAuth, adminController.downloadExcelReport);
router.get('/download/pdf', adminAuth, adminController.downloadPDFReport);

//customer managment

router.get("/users",adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);

//category managment
router.get("/Category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.post("/addCategoryoffer",adminAuth,categoryController.addCategoryOffer);
router.delete("/removeCategoryoffer",adminAuth,categoryController.removeCategoryOffer);
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);

//product management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts);
router.post("/addProductOffer",adminAuth,productController.addProductOffer);
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer);
router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images"),productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);

//order management
router.get("/orders", adminAuth, orderController.getListOfOrders);
router.get("/orders/:orderId", adminAuth, orderController.getOrderDetails);
router.post("/updateOrderStatus/:orderId", adminAuth, orderController.updateStatus);
router.post("/return-request", adminAuth, orderController.requestReturn);
router.post("/return-accept", adminAuth, orderController.returnAccept);
router.post("/return-reject", adminAuth, orderController.returnReject);

//coupon managment
router.get('/coupon',adminAuth,couponController.loadCoupon)
router.post('/coupon',adminAuth,couponController.createCoupon)
router.put('/coupon/:couponId',adminAuth,couponController.editCoupon)
router.delete('/coupon/:couponId',adminAuth,couponController.deleteCoupon)



module.exports=router;



