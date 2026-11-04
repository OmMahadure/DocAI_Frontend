import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import Swal from "sweetalert2";
import "./App.css";
import Auth from "./Auth";

const API_URL = import.meta.env.VITE_API_URL;

const apiFetch = (url, options = {}) => {
    const token = localStorage.getItem("token");

    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {})
        }
    });
};
function App() {

    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [isAuthenticated, setIsAuthenticated] = useState(
        () => Boolean(localStorage.getItem("token"))
    );

    const chatBoxRef = useRef(null);

    useEffect(() => {
        if (isAuthenticated) {
            loadDocuments();
        } else {
            setDocuments([]);
            setSelectedDocument(null);
            setMessages([]);
        }
    }, [isAuthenticated]);

    useEffect(() => {

        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop =
                chatBoxRef.current.scrollHeight;
        }

    }, [messages, loading]);


    const getAuthHeaders = () => {
        const token = localStorage.getItem("token");

        if (!token) {
            throw new Error("Please log in to continue.");
        }

        return {
            Authorization: `Bearer ${token}`
        };
    };


    // -------------------------
    // LOAD DOCUMENTS
    // -------------------------

    const loadDocuments = async () => {

        try {

            const response = await apiFetch(
                `${API_URL}/api/documents`,
                {
                    headers: getAuthHeaders()
                }
            );

            if (!response.ok) {
                throw new Error("Failed to load documents");
            }

            const data = await response.json();

            setDocuments(data);


            const savedDocumentId = localStorage.getItem("selectedDocumentId");

            if (savedDocumentId) {
                const savedDocument = data.find(
                    (doc) => String(doc.id) === savedDocumentId
                );

                if (savedDocument) {
                    await openDocumentHistory(savedDocument);
                } else {
                    localStorage.removeItem("selectedDocumentId");
                    setSelectedDocument(null);
                    setMessages([]);
                }
            } else {
                setSelectedDocument(null);
                setMessages([]);
            }
            return data;

        } catch (error) {

            console.error(error);

        }
    };




    // -------------------------
    // UPLOAD DOCUMENT
    // -------------------------

    const uploadDocument = async () => {

        if (!selectedFile) {
            setError("Please select a document first.");
            return;
        }

        setUploading(true);
        setError("");

        const formData = new FormData();

        formData.append("file", selectedFile);

        try {

            const response = await apiFetch(
                `${API_URL}/api/documents/upload`,
                {
                    method: "POST",
                    body: formData,
                    headers: getAuthHeaders()
                }
            );

            if (!response.ok) {
                const errorText = await response.text();

                throw new Error(errorText);
            }

            const uploadedFileName = selectedFile.name;
            const data = await response.json();

            console.log("Upload response:", data);

            Swal.fire({
                icon: "success",
                title: "Document Uploaded.",
                text: "Document uploaded successfully.",
                timer: 2500,
                customClass: {
                    popup: "success-popup"
                },
                showConfirmButton: false
            });

            setSelectedFile(null);
            document.getElementById("fileInput").value = "";

            const updatedDocuments = await loadDocuments();

            const newDocument = Array.isArray(updatedDocuments)
                ? updatedDocuments.find(
                    doc =>
                        String(doc.id) === String(data.id) ||
                        doc.fileName === uploadedFileName
                )
                : null;

            if (newDocument) {
                await openDocumentHistory(newDocument);
            }

        } catch (error) {

            console.error(error);

            setError(
                error.message || "Document upload failed. Please try again."
            );

        } finally {

            setUploading(false);

        }
    };

    //
    //DELETE DOCUMENT
    //


    const deleteDocument = async (document) => {
        const result = await Swal.fire({
            title: "Delete document?",
            text: `Are you sure you want to delete "${document.fileName}"?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#a020f0",
            cancelButtonColor: "#6b7280",
            reverseButtons: true,
            customClass: {
                popup: "delete-popup"
            }
        });

        if (!result.isConfirmed) return;

        try {
            const response = await apiFetch(
                `${API_URL}/api/documents/${document.id}`,
                {
                    method: "DELETE",
                    headers: getAuthHeaders()
                }
            );

            if (!response.ok) {
                throw new Error(await response.text());
            }

            setDocuments(prev =>
                prev.filter(item => item.id !== document.id)
            );

            if (selectedDocument?.id === document.id) {
                setSelectedDocument(null);
                setMessages([]);
                localStorage.removeItem("selectedDocumentId");
            }


        } catch (error) {
            console.error(error);
            setError("Failed to delete document.");
        }
    };




    // -------------------------
    // ASK QUESTION
    // -------------------------

    const askQuestion = async () => {

        if (!question.trim()) {
            return;
        }

        if (!selectedDocument) {
            setError("Please select a document first.");
            return;
        }

        setLoading(true);
        setError("");

        const userQuestion = question.trim();

        setMessages(prev => [
            ...prev,
            {
                type: "user",
                text: userQuestion
            }
        ]);

        setQuestion("");

        try {

            const response = await apiFetch(
                `${API_URL}/api/chat/ask?documentId=${encodeURIComponent(selectedDocument.id)}&question=${encodeURIComponent(userQuestion)}`,
                {
                    method: "POST",
                    headers: getAuthHeaders()
                }
            );

            if (!response.ok) {
                throw new Error("Failed to get answer");
            }

            const answer = await response.text();

            setMessages(prev => [
                ...prev,
                {
                    type: "ai",
                    text: answer
                }
            ]);

        } catch (error) {

            console.error(error);

            setError(
                "Unable to get an answer. Please try again."
            );

        } finally {

            setLoading(false);

        }
    };

    // -------------------------
    // LOAD SELECTED DOCUMENT HISTORY
    // -------------------------

    const openDocumentHistory = async (document) => {
        localStorage.setItem("selectedDocumentId", String(document.id));
        setSelectedDocument(document);
        setMessages([]);
        setQuestion("");
        setError("");

        try {

            const response = await apiFetch(
                `${API_URL}/api/chat/history/document/${document.id}`,
                {
                    headers: getAuthHeaders()
                }

            );

            if (!response.ok) {
                throw new Error("Failed to load document history");
            }

            const history = await response.json();
            const formattedMessages = [];

            history.forEach((chat) => {
                formattedMessages.push({
                    type: "user",
                    text: chat.question
                });

                formattedMessages.push({
                    type: "ai",
                    text: chat.answer
                });
            });

            setMessages(formattedMessages);

        } catch (error) {

            console.error("Error loading document history:", error);
            setError("Unable to load this document's history.");

        }
    };


    // -------------------------
    // ENTER KEY
    // -------------------------

    const handleKeyDown = (e) => {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            askQuestion();

        }
    };


    // -------------------------
    // CLEAR CHAT
    // -------------------------



    const clearChat = async () => {
        if (!selectedDocument) {
            setError("Please select a document first.");
            return;
        }

        const result = await Swal.fire({
            title: "Delete chat?",
            text: "This will permanently delete all messages.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#a020f0",
            cancelButtonColor: "#6b7280",
            reverseButtons: true,
            customClass: {
                popup: "delete-popup"
            }
        });

        if (!result.isConfirmed) return;

        try {
            const response = await apiFetch(
                `${API_URL}/api/chat/history/document/${selectedDocument.id}`,
                {
                    method: "DELETE",
                    headers: getAuthHeaders()
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to clear chat:  ${response.status} ${await response.text()}`);
            }

            setMessages([]);
            setError("");

        } catch (error) {
            console.error(error);
            setError(error.message || "Failed to clear chat history.");
        }
    };
    const handleLogout = () => {
        Swal.fire({
            title: "Are you sure?",
            text: "You will be logged out of DocAI.",
            icon: "warning",

            showCancelButton: true,
            confirmButtonText: "Yes, logout",
            cancelButtonText: "Cancel",

            confirmButtonColor: "#6551e8",
            cancelButtonColor: "#64748b",

            customClass: {
                popup: "logout-popup"
            },
            showClass: {
                popup: `
                animate__animated
                animate__fadeInUp
                animate__faster
            `
            },

            hideClass: {
                popup: `
                animate__animated
                animate__fadeOutDown
                animate__faster
            `
            }
        }).then((result) => {
            if (result.isConfirmed) {
                logout();
            }
        });
    };


    const logout = () => {
        // Clear authentication data
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("selectedDocumentId");

        // Clear Account A's frontend data
        setDocuments([]);
        setSelectedDocument(null);
        setMessages([]);
        setSelectedFile(null);
        setQuestion("");
        setError("");

        // Reset loading states
        setLoading(false);
        setUploading(false);

        // Display the login page
        setIsAuthenticated(false);
    };



    //login-success handler
    if (!isAuthenticated) {
        return (
            <Auth
                onAuthSuccess={async () => {
                    // Clear any previous account's data
                    setDocuments([]);
                    setSelectedDocument(null);
                    setMessages([]);
                    setSelectedFile(null);
                    setQuestion("");
                    setError("");

                    // Switch to the authenticated application
                    setIsAuthenticated(true);
                }}
            />
        );
    }

    return (

        <div className="app">

            {/* SIDEBAR */}

            <aside className={`sidebar ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>

                <div className="logo">

                    <div className="logo-icon">
                        AI
                    </div>

                    <div>
                        <h2>DocAI</h2>
                        <span>Document Assistant</span>
                    </div>

                    <button onClick={handleLogout}>Logout</button>

                </div>

                <button
                    className="mobile-menu-toggle"
                    onClick={() => setMobileMenuOpen(prev => !prev)}
                    aria-label="Toggle uploaded documents"
                >
                    ☰
                </button>

                {/* UPLOAD */}

                <div className="upload-section">

                    <h3>Documents</h3>

                    <label
                        htmlFor="fileInput"
                        className="file-label"
                    >
                        <span>Choose Document</span>
                    </label>

                    <input
                        id="fileInput"
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={(e) => {

                            if (e.target.files.length > 0) {

                                setSelectedFile(
                                    e.target.files[0]
                                );

                            }

                        }}
                    />


                    {selectedFile && (

                        <div className="selected-file">

                            <span>
                                {selectedFile.name}
                            </span>

                            <button
                                onClick={uploadDocument}
                                disabled={uploading}
                            >
                                {uploading
                                    ? "Processing..."
                                    : "Upload"}
                            </button>

                        </div>

                    )}

                </div>


                {/* DOCUMENT LIST */}

                <div className="document-list">

                    <h3>Your Documents</h3>

                    {documents.length === 0 && (

                        <p className="empty-documents">
                            No documents uploaded yet.
                        </p>

                    )}


                    {documents.map((document) => (
                        <div className="document-item" key={document.id}>
                            <button
                                type="button"
                                className={`document-select ${selectedDocument?.id === document.id ? "selected" : ""
                                    }`}
                                title={document.fileName}
                                onClick={() => {
                                    openDocumentHistory(document);
                                    setMobileMenuOpen(false);
                                }}
                            >
                                📄 {document.fileName}
                            </button>

                            <button
                                type="button"
                                className="delete-button"
                                onClick={() => deleteDocument(document)}

                            >
                                <span className="material-symbols-outlined">
                                    delete
                                </span>
                            </button>
                        </div>
                    ))}


                </div>

            </aside>
            <div
                className="sidebar-resizer"
                onMouseDown={(e) => {
                    e.preventDefault();

                    const sidebar = e.currentTarget.previousElementSibling;
                    const startX = e.clientX;
                    const startWidth = sidebar.getBoundingClientRect().width;

                    const onMouseMove = (event) => {
                        const width = Math.min(
                            450,
                            Math.max(200, startWidth + event.clientX - startX)
                        );
                        sidebar.style.width = `${width}px`;
                        sidebar.style.flexBasis = `${width}px`;
                    };

                    const onMouseUp = () => {
                        document.removeEventListener("mousemove", onMouseMove);
                        document.removeEventListener("mouseup", onMouseUp);
                    };

                    document.addEventListener("mousemove", onMouseMove);
                    document.addEventListener("mouseup", onMouseUp);
                }}
            />

            {/* MAIN CHAT */}

            <main className="main">

                {/* HEADER */}

                <header className="chat-header">

                    <div>

                        <h1>
                            {selectedDocument
                                ? selectedDocument.fileName
                                : "AI Document Assistant"}
                        </h1>

                        <p>
                            {selectedDocument
                                ? "Chat history for this document"
                                : "Select a document to view its chat history"}
                        </p>

                    </div>

                    {/* CLEAR CHAT */}

                    <button
                        className="clear-button"
                        onClick={clearChat}
                    >
                        <span className="material-symbols-outlined">
                            delete
                        </span>
                        Clear chat
                    </button>

                </header>


                {/* ERROR */}

                {error && (

                    <div className="error-message">

                        {error}

                        <button
                            onClick={() => setError("")}
                        >
                            ×
                        </button>

                    </div>

                )}


                {/* CHAT */}

                <div
                    className="chat-box"
                    ref={chatBoxRef}
                >

                    {messages.length === 0 && (

                        <div className="welcome">

                            <div className="welcome-icon">
                                🤖
                            </div>

                            <h2>
                                How can I help you?
                            </h2>

                            <p>
                                {selectedDocument
                                    ? "Ask questions about the document"
                                    : "Upload your documents and ask questions about their content."}
                            </p>

                            <div className="example-questions">

                                <button
                                    onClick={() =>
                                        setQuestion(
                                            "What is this document about?"
                                        )
                                    }
                                >
                                    What is this document about?
                                </button>

                                <button
                                    onClick={() =>
                                        setQuestion(
                                            "Summarize the important information."
                                        )
                                    }
                                >
                                    Summarize the important information
                                </button>

                                <button
                                    onClick={() =>
                                        setQuestion(
                                            "What skills are mentioned?"
                                        )
                                    }
                                >
                                    What skills are mentioned?
                                </button>

                            </div>

                        </div>

                    )}


                    {messages.map((message, index) => (

                        <div
                            key={index}
                            className={`message-row ${message.type}`}
                        >

                            <div className="message-avatar">

                                {message.type === "user"
                                    ? "You"
                                    : "AI"}

                            </div>

                            <div className="message-content">

                                <ReactMarkdown>
                                    {message.text}
                                </ReactMarkdown>

                            </div>

                        </div>

                    ))}


                    {loading && (

                        <div className="message-row ai">

                            <div className="message-avatar">
                                AI
                            </div>

                            <div className="message-content">

                                <div className="typing">

                                    <span></span>
                                    <span></span>
                                    <span></span>

                                </div>

                            </div>

                        </div>

                    )}

                </div>


                {/* INPUT */}

                <div className="input-container">

                    <div className="input-box">

                        <textarea
                            type="text"
                            value={question}
                            onChange={(e) =>
                                setQuestion(
                                    e.target.value
                                )
                            }
                            onKeyDown={handleKeyDown}
                            placeholder="Ask something about your documents..."
                            disabled={loading}
                        />

                        <button
                            onClick={askQuestion}
                            disabled={
                                loading ||
                                !question.trim()
                            }
                        >
                            <span className="material-symbols-outlined">
                                arrow_upward_alt
                            </span>
                        </button>

                    </div>

                    <p className="input-hint">
                        AI answers are generated only from
                        your uploaded documents.
                    </p>

                </div>

            </main>

        </div>
    );
}

export default App;