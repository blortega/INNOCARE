import React, { useState } from "react";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import "../styles/ForgotPassword.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const auth = getAuth();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setEmailSent(true);
      setLoading(false);
    } catch (error) {
      setError(
        error.code === "auth/user-not-found"
          ? "No user found with this email address."
          : error.code === "auth/invalid-email"
          ? "Please enter a valid email address."
          : "An error occurred. Please try again later."
      );
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <h2>Reset Your Password</h2>

      {emailSent ? (
        <div className="success-message">
          <p>
            Password reset email sent! Check your inbox for further
            instructions.
          </p>
          <button onClick={() => setEmailSent(false)}>
            Send another reset email
          </button>
        </div>
      ) : (
        <form onSubmit={handleResetPassword}>
          <p>
            Enter your email address and we'll send you a link to reset your
            password.
          </p>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            disabled={loading || !email}
            className="reset-button"
          >
            {loading ? "Sending..." : "Send Reset Email"}
          </button>
        </form>
      )}

      <div className="links">
        <a href="/">Back to Login</a>
      </div>
    </div>
  );
};

export default ForgotPassword;
