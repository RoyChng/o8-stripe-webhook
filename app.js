require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const { default: Stripe } = require("stripe");
const app = express();
const endpointSecret = process.env.ENDPOINT_SECRET;

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    let event = request.body;
    if (endpointSecret) {
      // Get the signature sent by Stripe
      const signature = request.headers["stripe-signature"];
      try {
        // Verifies that event is from Stripe
        event = stripe.webhooks.constructEvent(
          request.body,
          signature,
          endpointSecret
        );
      } catch (err) {
        console.log(`⚠️  Webhook signature verification failed.`, err.message);
        return response.sendStatus(400);
      }
    }

    // Returns if wrong event type
    if (event.type !== "invoice.payment_succeeded") return response.send();
    const dataObject = event.data.object;

    // Returns if not for subscription
    if (dataObject.billing_reason !== "subscription_cycle")
      return response.send();

    // Retrieve charge
    const charge = await stripe.charges.retrieve(dataObject.charge, {
      expand: ["transfer"],
    });

    // Update charge with original description
    const updatedCharge = await stripe.charges.update(
      charge.transfer.destination_payment,
      {
        description: charge.description,
      },
      {
        stripeAccount: charge.on_behalf_of,
      }
    );

    console.log("Updated Charge");
    console.log(updatedCharge);

    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

app.listen(7001, () => console.log("Running on port 7001"));
