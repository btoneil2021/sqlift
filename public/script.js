async function testBackend() {
    try {
        const response = await fetch('/api/supabase/health');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Success from Supabase-backed API:", data);
        
        const usernames = (data.sample_users || []).map((user) => user.username).join(', ');
        document.querySelector('p').innerText = usernames
            ? `Supabase connected. Sample users: ${usernames}`
            : 'Supabase connected, but no users were returned yet.';
    } catch (error) {
        console.error("Supabase connection failed:", error);
        document.querySelector('p').innerText = "Failed to connect to Supabase from the backend.";
    }
}

testBackend();
