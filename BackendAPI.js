// Function to get ONLY nearby potholes for the map
export const getNearbyHazards = async (userLat, userLng) => {
  // Create an invisible 5km bounding box around the user
  const offset = 0.05; 
  const minLat = userLat - offset;
  const maxLat = userLat + offset;
  const minLng = userLng - offset;
  const maxLng = userLng + offset;

  try {
    // Tell Supabase to only fetch rows inside this square
    const { data, error } = await supabase
      .from('hazards') // Make sure this matches your exact table name!
      .select('*')
      .gte('latitude', minLat)    // Greater than or equal to Bottom edge
      .lte('latitude', maxLat)    // Less than or equal to Top edge
      .gte('longitude', minLng)   // Greater than or equal to Left edge
      .lte('longitude', maxLng);  // Less than or equal to Right edge

    if (error) throw error;
    
    return data; // Hands the perfectly filtered list back to the frontend map!

  } catch (error) {
    console.error("Map Query Error:", error.message);
    return [];
  }
};