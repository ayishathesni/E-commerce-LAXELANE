const mongoose = require("mongoose"); 
const User = require("../../models/userSchema");

const customerInfo = async (req, res) => {
    try {
        const search = req.query.search ? req.query.search.trim() : "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const searchQuery = search
            ? {
                  $or: [
                      { name: { $regex: ".*" + search + ".*", $options: "i" } },
                      { email: { $regex: ".*" + search + ".*", $options: "i" } },
                      { phone: isNaN(search) ? null : search } 
                  ].filter(Boolean) 
              }
            : {};

        const query = { isAdmin: false, ...searchQuery };

        const userData = await User.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .select("name email phone googleId isBlocked")
            .lean();

        const count = await User.countDocuments(query);

        res.render("admin/customer", {
            data: userData,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            search: search
        });

    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).send("Internal Server Error");
    }
};

const customerBlocked = async (req, res) => {
    try {
        const id = req.query.id;
        console.log("Received ID:", id);

     
        const user = await User.findOneAndUpdate(
            { $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { googleId: id }] },
            { $set: { isBlocked: true } },
            { new: true } 
        );

        if (!user) {
            console.error("User not found:", id);
            return res.status(404).send("User not found");
        }

        console.log("User blocked successfully:", user);
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error blocking user:", error);
        res.redirect("/pageerror");
    }
};

const customerunBlocked = async (req, res) => {
    try {
        const id = req.query.id;
        console.log("Received ID:", id);

       
        const user = await User.findOneAndUpdate(
            { $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { googleId: id }] },
            { $set: { isBlocked: false } },
            { new: true } 
        );

        if (!user) {
            console.error("User not found:", id);
            return res.status(404).send("User not found");
        }

        console.log("User unblocked successfully:", user);
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error unblocking user:", error);
        res.redirect("/pageerror");
    }
};





module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked
};
