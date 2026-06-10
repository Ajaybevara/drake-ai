# Use an official Python runtime as a parent image
FROM python:3.12.1

# Set the working directory in the container
WORKDIR /app

# Add this in your Dockerfile before running the Python commands
RUN apt-get update && apt-get install -y libgl1-mesa-glx

# Copy the requirements file to the container
COPY requirements.txt requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . /app

# Expose the port that Flask will run on
EXPOSE 8507

# Command to run the Flask app with SocketIO using Gunicorn
# CMD ["gunicorn", "-w", "1", "-k", "eventlet", "-b", "0.0.0.0:8507", "app:app"]
CMD ["python", "app.py"]