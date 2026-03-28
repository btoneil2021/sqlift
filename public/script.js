async function testBackend() {
    try {
        const response = await fetch('/api/hello'); 
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Success from Backend:", data);
        
        document.querySelector('p').innerText = `Backend says: ${data.message}`;
    } catch (error) {
        console.error("Connection failed:", error);
        document.querySelector('p').innerText = "Failed to connect to backend.";
    }
}

testBackend();