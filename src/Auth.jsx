import { useState } from "react";

function Auth({ onAuthSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        // Allow only Gmail addresses
    const gmailRegex = /^[A-Za-z0-9._%+-]+@gmail\.com$/;

    if (!gmailRegex.test(email.trim())) {
        setError("Enter valid Gmail address");
        return;
    }
        setLoading(true);


const API_URL = import.meta.env.VITE_API_URL;
        try {
            const endpoint = isLogin ? "login" : "register";

            const body = isLogin
                ? { email, password }
                : { name, email, password };

            const response = await fetch(
                `${API_URL}/api/auth/${endpoint}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body)
                }
            );

            const data = await response.json().catch(() => null);

if (!response.ok) {
    if (isLogin) {
        throw new Error(
            "Invalid email or password."
        );
    }

    throw new Error(
        typeof data === "string"
            ? data
            : data?.message || "Registration failed. Please try again."
    );
}

            if (!isLogin) {
                setIsLogin(true);
                setPassword("");
                setError("Registration successful. Please log in.");
                return;
            }

            if (!data?.token) {
                throw new Error("JWT token was not returned by the server.");
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify({
                id: data.id,
                name: data.name,
                email: data.email
            }));

            onAuthSuccess();

        } catch (err) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };


return (
    <div className="auth-container">
        <form className="auth-card" onSubmit={handleSubmit}>

            <h1>DocAI</h1>
            <p className="auth-subtitle">
                AI-powered Document Assistant
            </p>

            <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>

            
            {!isLogin && (
                <>
                <label>Name</label>
            <div className="auth-input-wrapper">
                <span class="material-symbols-outlined auth-icon">
person
</span>
                <input className="name-input"
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                </div>
                </>
            )}
            

            <label>Email address</label>
            <div className="auth-input-wrapper">
                <span className="material-symbols-outlined auth-icon">
    mail
</span>
                <input
                    type="email"
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    pattern="[A-Za-z0-9._%+-]+@gmail\.com"
    title="Please enter a valid Gmail address"
                />
            </div>

            <label>Password</label>
            <div className="auth-input-wrapper">
                <span className="material-symbols-outlined auth-icon">
    key
</span>
                <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                />

                <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                >
                   {showPassword ? (
    <span className="material-symbols-outlined">visibility_off</span>
) : (
    <span className="material-symbols-outlined">visibility</span>
)}
                </button>
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button
                type="submit"
                className="auth-submit"
                disabled={loading}
            >
                {loading
                    ? "Please wait..."
                    : isLogin ? "Login" : "Sign up"}
            </button>

            <p className="auth-switch-text">
                {isLogin
                    ? "Don't have an account?"
                    : "Have an account already?"}

                <button
                    type="button"
                    className="auth-switch"
                    onClick={() => {
                        setIsLogin(!isLogin);
                        setError("");
                        setPassword("");
                    }}
                >
                    {isLogin ? "Register" : "Sign in"}
                </button>
            </p>

        </form>
    </div>
);

}

export default Auth;