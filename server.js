const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client - Replace with your actual values
const supabaseUrl = 'https://istuwvpfudgrwkpckypl.supabase.co'; // Replace with your Supabase project URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdHV3dnBmdWRncndrcGNreXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0OTI1NjYsImV4cCI6MjA3NDA2ODU2Nn0.Fw38hB4jqSv0IH5lKrKJvarQwDt1DaQyCiJ0aqsDYDE'; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Generate unique user ID
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// API Routes

// Generate user ID endpoint (optional - client generates its own)
app.post('/api/generate-user-id', (req, res) => {
  const userId = generateUserId();
  res.json({ userId });
});

// Save swipe data
app.post('/api/swipe', async (req, res) => {
  try {
    const {
      userId,
      username,
      roomSide,
      swipeDirection,
      response,
      timestamp,
      melbourneTime,
      userAgent
    } = req.body;
    
    // Validate required fields
    if (!userId || !username || !roomSide || !swipeDirection || !response) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['userId', 'username', 'roomSide', 'swipeDirection', 'response']
      });
    }
    
    const swipeRecord = {
      user_id: userId,
      username: username,
      room_side: roomSide,
      swipe_direction: swipeDirection,
      response: response,
      timestamp: timestamp || new Date().toISOString(),
      melbourne_time: melbourneTime,
      user_agent: userAgent,
      created_at: new Date().toISOString()
    };
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('depth_perception_swipes') // Replace with your actual table name
      .insert([swipeRecord]);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to save swipe data',
        details: error.message 
      });
    }
    
    console.log('Swipe data saved:', {
      userId: userId,
      username: username,
      roomSide: roomSide,
      response: response,
      timestamp: melbourneTime
    });
    
    res.json({ 
      success: true, 
      message: 'Swipe recorded successfully',
      data: swipeRecord
    });
    
  } catch (error) {
    console.error('Error saving swipe data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get all swipe data (for analysis/admin purposes)
app.get('/api/swipes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('depth_perception_swipes')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch swipe data',
        details: error.message 
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching swipe data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get swipes by user ID
app.get('/api/swipes/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('depth_perception_swipes')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch user swipe data',
        details: error.message 
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching user swipe data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get analytics/summary data
app.get('/api/analytics', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('depth_perception_swipes')
      .select('*');
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch analytics data',
        details: error.message 
      });
    }
    
    // Process analytics
    const analytics = {
      totalSwipes: data.length,
      totalUsers: new Set(data.map(item => item.user_id)).size,
      roomDistribution: {
        A: data.filter(item => item.room_side === 'A').length,
        B: data.filter(item => item.room_side === 'B').length
      },
      responseDistribution: {
        yes: data.filter(item => item.response === 'yes').length,
        no: data.filter(item => item.response === 'no').length
      },
      swipesByRoom: {
        A: {
          yes: data.filter(item => item.room_side === 'A' && item.response === 'yes').length,
          no: data.filter(item => item.room_side === 'A' && item.response === 'no').length
        },
        B: {
          yes: data.filter(item => item.room_side === 'B' && item.response === 'yes').length,
          no: data.filter(item => item.room_side === 'B' && item.response === 'no').length
        }
      },
      timeRange: {
        earliest: data.length > 0 ? Math.min(...data.map(item => new Date(item.timestamp).getTime())) : null,
        latest: data.length > 0 ? Math.max(...data.map(item => new Date(item.timestamp).getTime())) : null
      }
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    melbourneTime: new Date().toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne'
    })
  });
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle 404s
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

app.listen(PORT, () => {
  console.log(`🎭 Depth Perception Server running on port ${PORT}`);
  console.log(`📍 Melbourne time: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })}`);
  console.log(`🗄️ Database: Supabase connected`);
  console.log(`🌐 App URL: http://localhost:${PORT}`);
  console.log(`📊 Analytics URL: http://localhost:${PORT}/api/analytics`);
});