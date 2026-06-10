// static/js/projects.js
document.addEventListener('DOMContentLoaded', function() {
    const createProjectBtn = document.getElementById('create-project-btn');
    const createProjectForm = document.getElementById('create-project-form-div');

    createProjectBtn.addEventListener('click', function() {
        createProjectForm.classList.toggle('hidden');
    });


    createProjectForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var projectName = document.getElementById('project-name-input').value;
        fetch('/create_project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'project_name=' + encodeURIComponent(projectName)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = data.redirect;
            } else {
                alert(data.message);
            }
        });
    });
});