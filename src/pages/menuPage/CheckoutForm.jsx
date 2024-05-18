import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import useAxiosSecure from "../../hooks/useAxiosSecure";
import useAuth from "../../hooks/useAuth";

const CheckoutForm = ({ price, cart }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const axiosSecure = useAxiosSecure();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof price !== "number" || price < 1) {
      console.error(
        "Invalid price value. Must be a number greater than or equal to 1."
      );
      return;
    }

    axiosSecure
      .post("/create-payment-intent", { price })
      .then((res) => {
        console.log(res.data.clientSecret);
        console.log(price);
        setClientSecret(res.data.clientSecret);
      })
      .catch((error) => {
        console.error("Error creating PaymentIntent:", error);
      });
  }, [price, axiosSecure]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.error("Stripe.js has not loaded yet.");
      return;
    }

    const card = elements.getElement(CardElement);

    if (!card) {
      console.error("Card Element not found.");
      return;
    }

    try {
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card,
      });

      if (error) {
        console.error("[Stripe error]", error);
        setCardError(error.message);
        return;
      }

      const { paymentIntent, error: confirmError } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: card,
            billing_details: {
              name: user?.displayName || "anonymous",
              email: user?.email || "unknown",
            },
          },
        });

      if (confirmError) {
        console.error("[Confirmation error]", confirmError);
        setCardError(confirmError.message);
        return;
      }

      console.log("paymentIntent", paymentIntent);

      if (paymentIntent && paymentIntent.status === "succeeded") {
        const transactionId = paymentIntent.id;
        setCardError(`Your transactionId is: ${transactionId}`);

        const paymentInfo = {
          email: user.email,
          transitionId: transactionId,
          price,
          quantity: cart.length,
          status: "order pending",
          itemsName: cart.map((item) => item.name),
          cartItems: cart.map((item) => item._id),
          menuItems: cart.map((item) => item.menuItemId),
        };

        axiosSecure
          .post("/payments", paymentInfo)
          .then((res) => {
            console.log(res.data);
            if (res.data) {
              alert("Payment info sent successfully!");
              navigate("/order");
            }
          })
          .catch((error) => {
            console.error("Error sending payment info:", error);
            setCardError("Error processing payment. Please try again later.");
          });
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      setCardError("An unexpected error occurred. Please try again later.");
    }
  };

  return (
    <div className="flex flex-col sm:flex-row justify-start items-start gap-8">
      <div className="md:w-1/2 space-y-3">
        <h4 className="text-lg font-semibold">Order Summary</h4>
        <p>Total Price: ${price}</p>
        <p>Number of Items: {cart.length}</p>
      </div>
      <div
        className={
          "md:w-1/3 w-full border space-y-5  card shrink-0 max-w-sm shadow-2xl bg-base-100 px-4 py-8"
        }
      >
        <h4 className="text-lg font-semibold">Process your Payment!</h4>
        <h5 className="font-medium">Credit/Debit Card</h5>
        <form onSubmit={handleSubmit}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#424770",
                  "::placeholder": {
                    color: "#aab7c4",
                  },
                },
                invalid: {
                  color: "#9e2146",
                },
              },
            }}
          />
          <button
            type="submit"
            disabled={!stripe || !clientSecret}
            className="btn btn-primary btn-sm mt-5 w-full"
          >
            Pay
          </button>
        </form>
        {cardError && <p className="text-red text-xs italic">{cardError}</p>}
        <div className="mt-5 text-center">
          <hr />
        </div>
      </div>
    </div>
  );
};

export default CheckoutForm;
