const express = require("express");
const paymentRouter = express.Router();
const Payment = require("../models/Payment");
const amqp = require("amqplib");
const {validateWebhookSignature} = require('razorpay/dist/utils/razorpay-utils');
const mongoose = require('mongoose');

/**
 * @route POST /api/payments
 * @description Retrieves payment records.
 * Can filter payments by `orderId`  using query parameters.
 * @query orderId {string} - Optional. The MongoDB _id of the order to filter payments by.
 */
paymentRouter.post('/api/payments', async (req, res) => {
    try {
        const apiKey = req.get('x-api-key');
         if (!apiKey || apiKey !== process.env.PAYMENT_SERVICE_TOKEN) {
            return res.status(401).json({
                sucess: false,
                error: 'Unauthorized' 
            });
        }
        const {orderIds} = req.body;
        let queryFilter = {};
        if(orderIds.length != 0) {
            queryFilter.orderId = {$in:orderIds}
        }
        const payments = await Payment.find(queryFilter).select('-__v -_id');
        let message = "Payments retrieved successfully";

        res.status(200).json({
            message: message,
            success: true,
            data: payments
        });
    } catch (err) {
        res.status(500).json({
            message: 'failed to retrieve payments',
            success: false,
            data: err
        });
    }
});
/**
 * @route   POST /api/payment/hook
 * @desc    Razorpay Webhook Handler - Handles payment status updates from Razorpay
 * @access  Public (should be protected by signature verification) 
 **/
paymentRouter.post('/api/payment/hook', async(req,res)=>{
     try {
        console.log("test");
        const signature = req.get('X-Razorpay-Signature');
        const isWebhookValid = validateWebhookSignature(JSON.stringify(req.body), 
        signature,
        process.env.RAZORPAY_WEBHOOK_SECRET);

        if (!isWebhookValid) {
            return sendErrorResponse(res, 400, "webhook signature is invalid");
        }
        const paymentDetails = req.body.payload.payment.entity;
       
        const payment = await Payment.findOne({ orderId: paymentDetails.order_id});
        payment.status = paymentDetails.status;
        await payment.save(); 
        console.log("payment saved");
        let status = "pending";
       if (req.body.event == "payment.captured") {
            status = "captured";
        } else if (req.body.event == "payment.failed") {
            status = "failed";
        }
        //publish event to RabbitMQ for cocofields to consume
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        const channel = await connection.createChannel();

        const exchange = 'payment_events';
        await channel.assertExchange(exchange, 'fanout', {durable: true});

        const eventPayload = {
            paymentDetails: paymentDetails,
            paymentStatus: status,
        };

        channel.publish(exchange, '', Buffer.from(JSON.stringify(eventPayload)));

        await channel.close();
        await connection.close();
        console.log("webhook handled");
        res.status(200).json({ msg: "Webhook handled and event published" });

    } catch (err) {
        console.error("Error in webhook handler:", err);
        return res.status(500).json({ msg: err.message });
    }
});

module.exports = paymentRouter;