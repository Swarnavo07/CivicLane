{
  "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXBidnJjcGdpdHZrdnFqdHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTI1NTIsImV4cCI6MjA4ODA4ODU1Mn0.oOlEUWIseiJRZYSJWURu_cH36CTnpsiVmJ6xGkOPORU",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXBidnJjcGdpdHZrdnFqdHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTI1NTIsImV4cCI6MjA4ODA4ODU1Mn0.oOlEUWIseiJRZYSJWURu_cH36CTnpsiVmJ6xGkOPORU",
  "Content-Type": "application/json"
}

const verifyPothole = async (base64Image) => {
  const response = await fetch(
    "https://detect.roboflow.com/pothole-vhmow-kjr71/1?api_key=IQxP3o1vXxb8IOm35xXh", 
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: base64Image
    }
  );
  const aiResult = await response.json();
  
  // aiResult.predictions will contain the bounding boxes and confidence score!
  console.log(aiResult); 
}