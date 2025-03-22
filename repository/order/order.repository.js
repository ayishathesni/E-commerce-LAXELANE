const Order = require("../../models/orderSchema");

 const getOrderById = (id) => {
    return Order.findById(id).populate()
}

 const getOrderByIdAndUpdate = (id, data) => {
    return Order.findByIdAndUpdate(id, data, { new: true })
}

const getOrderByIdAndCanecl = (id)=>{
    return Order.findByIdAndUpdate(id,{status:"cancelled"})
}

module.exports = {
    getOrderById,
    getOrderByIdAndUpdate
}