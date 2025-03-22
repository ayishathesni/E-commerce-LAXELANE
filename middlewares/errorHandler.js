const errorHandler = (err, req, res, next) => {
    console.error(err.stack);  

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500);

    const isAdminRoute = req.originalUrl.startsWith('/admin');
    
    if (isAdminRoute) {
        res.render("pageerror", {  
            message: err.message || "Something went wrong on the admin side.",
            status: err.status || 500,
        });
    } else {
        res.render("user/page404", {  
            title: "User Error",
            message: err.message || "Something went wrong on the user side.",
            status: err.status || 500,
        });
    }
}

module.exports = errorHandler;