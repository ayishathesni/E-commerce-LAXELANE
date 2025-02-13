const User = require("../models/userSchema")

const userAuth = async (req, res, next) => {
  try {
    // Allow access to login page without redirecting
    if (req.path === "/login") {
      return next();
    }

    if (!req.session.user) {
      return res.redirect("/login"); // Redirect only if user is not logged in
    }

    const user = await User.findById(req.session.user);
    if (!user || user.isBlocked) {
      req.session.destroy(); // Destroy session to prevent looping
      return res.redirect("/login");
    }

    next(); // Proceed if user is valid and not blocked
  } catch (error) {
    console.error("Error in user auth middleware:", error);
    return res.status(500).send("Internal Server Error");
  }
};


const adminAuth=(req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
        next();
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error in admin auth middleware",error);
        res.status(500).send("Internal Server Error")
    })
}

module.exports={
    userAuth,
    adminAuth
}