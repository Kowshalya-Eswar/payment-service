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
            res.status(401).json({
                sucess: false,
                error: 'Unauthorized' 
            });
        }
        const {orderIds} = req.body;
        let queryFilter = {};
        if(orderIds) {
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
paymentRouter.get('/api/payment/hook', async(req,res)=>{
     try {
       /* const signature = req.get('X-Razorpay-Signature');
        const isWebhookValid = validateWebhookSignature(JSON.stringify(req.body), 
        signature,
        process.env.RAZORPAY_WEBHOOK_SECRET);

        if (!isWebhookValid) {
            return sendErrorResponse(res, 400, "webhook signature is invalid");
        } */
        //const paymentDetails = req.body.payload.payment.entity;
        const paymentDetails = {
            order_id: 'order_R3JSKZsz5rJVPv',
            receipt: 'rec_ddf6ecc9-c61b-4606-ad8c-f774a376cee7',
            amountPaid: '1000',
            status: 'captured',
            notes :{
                firstName :'test',
                lastName: 'test',
                email: 'kowsi.ganeshan@gmail.com'
            }
        };
       
        const payment = await Payment.findOne({ orderId: paymentDetails.order_id});
        payment.status = paymentDetails.status;
        await payment.save(); 
       
        //publish event to RabbitMQ for cocofields to consume
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        const channel = await connection.createChannel();

        const exchange = 'payment_events';
        await channel.assertExchange(exchange, 'fanout', {durable: true});

        const eventPayload = {
            paymentDetails: paymentDetails,
            paymentStatus: payment.status,
        };

        channel.publish(exchange, '', Buffer.from(JSON.stringify(eventPayload)));

        await channel.close();
        await connection.close();

        res.status(200).json({ msg: "Webhook handled and event published" });

    } catch (err) {
        console.error("Error in webhook handler:", err);
        return res.status(500).json({ msg: err.message });
    }
});

module.exports = paymentRouter;