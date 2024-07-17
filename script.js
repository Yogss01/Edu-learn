document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
          
            try {
                const response = await fetch('http://localhost:3000/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
          
                if (!response.ok) {
                    throw new Error('Login failed');
                }
          
                const result = await response.json();
          
                // Store the session token locally (e.g., in sessionStorage or localStorage)
                sessionStorage.setItem('sessionToken', result.token);
          
                // Redirect to welcome page with username
                window.location.href = `welcome.html?username=${username}`;
          
            } catch (error) {
                // Display error message
                document.getElementById('errorMessage').innerText = error.message || 'Login failed. Please try again.';
            }
        });
    }

    async function accessResource(resource) {
        try {
            const sessionToken = sessionStorage.getItem('sessionToken');
      
            const response = await fetch(`/${resource}`, {
                headers: {
                    'Authorization': sessionToken
                }
            });
      
            if (!response.ok) {
                throw new Error('Failed to access resource');
            }
      
            // Handle the response (e.g., display or process resource content)
            const content = await response.text();
            document.getElementById('resourceContent').innerHTML = content;
      
        } catch (error) {
            console.error(`Error accessing ${resource}:`, error.message);
            // Handle error (e.g., display error message)
        }
    }
    
    // Example usage after logging in
    const resource1Button = document.getElementById('resource1Button');
    const resource2Button = document.getElementById('resource2Button');
    const resource3Button = document.getElementById('resource3Button');
    
    if (resource1Button) {
        resource1Button.addEventListener('click', () => accessResource('resource1'));
    }
    if (resource2Button) {
        resource2Button.addEventListener('click', () => accessResource('resource2'));
    }
    if (resource3Button) {
        resource3Button.addEventListener('click', () => accessResource('resource3'));
    }
});
