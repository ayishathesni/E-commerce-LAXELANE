const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { Schema } = mongoose;



const orderSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        size: {
            type: String,
            enum: ["XS", "S", "M", "L", "XL", "XXL"],
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned', "Failed"],
            default: 'Pending'
        },
        cancelReason: {
            type: String,
            trim: true
        },
        productImage: {
            type: [String],
            required: true
        },
        returnReason: {
            type: String,
            trim: true
        },
        returnStatus: {
            type: String,
            enum: ['', 'Pending', 'Approved', 'Rejected'],
            default: ''
        },
        returnRequestedAt: {
            type: Date
        },
    }],
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    finalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: "Address",
        required: true
    },
    invoiceDate: {
        type: Date
    },
    cancelReason: {
        type: String,
        trim: true
      },
    returnReason: {
        type: String,
        trim: true
    },
    returnStatus: {
        type: String,
        enum: ['', 'Pending', 'Approved', 'Rejected'],
        default: ''
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned', "Failed"],
        default: "Pending"
    },
    paymentMethod: {
        type: String,
        required: true,
        // enum: ['COD', 'ONLINE', 'WALLET']
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;

















   

