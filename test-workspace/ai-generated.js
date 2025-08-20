/**
 * This function processes user data and returns formatted results
 * @param {Object} userData - The user data object
 * @param {Object} options - Processing options
 * @returns {Object} Processed and formatted user data
 */
function processUserData(userData, options = {}) {
  // Validate input parameters
  if (!userData || typeof userData !== 'object') {
    throw new Error('userData must be a valid object');
  }

  // Initialize result object
  const result = {
    processed: true,
    timestamp: new Date().toISOString(),
    data: null
  };

  try {
    // Main processing logic
    const processedData = {
      id: userData.id || generateId(),
      name: userData.name || 'Unknown User',
      email: userData.email || '',
      settings: { ...defaultSettings, ...userData.settings }
    };

    // Apply any additional processing options
    if (options.includeMetadata) {
      processedData.metadata = {
        processedAt: result.timestamp,
        version: '1.0.0'
      };
    }

    result.data = processedData;
    return result;

  } catch (error) {
    console.error('Error processing user data:', error.message);
    throw new Error(`Processing failed: ${error.message}`);
  }
}

// Helper function to generate unique IDs
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Default user settings
const defaultSettings = {
  theme: 'light',
  notifications: true,
  language: 'en'
};