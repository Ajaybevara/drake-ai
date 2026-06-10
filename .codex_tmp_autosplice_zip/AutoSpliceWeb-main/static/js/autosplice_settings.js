document.getElementById('settingsBtn').addEventListener('click', function() {
    fetch('/get_params')
        .then(response => response.json())
        .then(params => {
            const form = document.getElementById('paramsForm');
            form.innerHTML = ''; // Clear existing form fields
            for (const key in params) {
                const label = document.createElement('label');
                label.htmlFor = key;
                label.textContent = key.replace(/_/g, ' ') + ':';
                form.appendChild(label);
    
                const input = document.createElement('input');
                input.type = 'text';
                input.id = key;
                input.name = key;
                input.value = params[key];
                form.appendChild(input);
                form.appendChild(document.createElement('br'));
            }
            document.getElementById('settingsModal').style.display = 'block';
        });
});

function saveSettings() {
    const form = document.getElementById('paramsForm');
    const formData = new FormData(form);
    const json = Object.fromEntries(formData.entries());
    fetch('/save_params', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(json),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        document.getElementById('settingsModal').style.display = 'none';
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}
