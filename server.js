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
      userAgent,
      sessionDuration,
      swipesInWindow,
      swipesPerSecond,
      maxSwipesPerSecond,
      certaintyPercentage
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
      session_duration: sessionDuration || 0,
      swipes_in_window: swipesInWindow || 0,
      swipes_per_second: swipesPerSecond || 0,
      max_swipes_per_second: maxSwipesPerSecond || 0,
      certainty_percentage: certaintyPercentage || 0,
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
      certaintyPercentage: certaintyPercentage,
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

// Get certainty analytics for a specific user
app.get('/api/certainty/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('depth_perception_swipes')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch user certainty data',
        details: error.message 
      });
    }
    
    // Calculate certainty metrics
    const certaintyAnalytics = {
      userId: userId,
      totalSwipes: data.length,
      averageCertainty: data.length > 0 ? 
        data.reduce((sum, swipe) => sum + (swipe.certainty_percentage || 0), 0) / data.length : 0,
      maxCertainty: data.length > 0 ? 
        Math.max(...data.map(swipe => swipe.certainty_percentage || 0)) : 0,
      minCertainty: data.length > 0 ? 
        Math.min(...data.map(swipe => swipe.certainty_percentage || 0)) : 0,
      maxSwipesPerSecond: data.length > 0 ? 
        Math.max(...data.map(swipe => swipe.max_swipes_per_second || 0)) : 0,
      certaintyDistribution: {
        high: data.filter(swipe => (swipe.certainty_percentage || 0) >= 75).length,
        medium: data.filter(swipe => (swipe.certainty_percentage || 0) >= 50 && (swipe.certainty_percentage || 0) < 75).length,
        low: data.filter(swipe => (swipe.certainty_percentage || 0) < 50).length
      },
      responsesByRoom: {
        A: {
          yes: data.filter(swipe => swipe.room_side === 'A' && swipe.response === 'yes').length,
          no: data.filter(swipe => swipe.room_side === 'A' && swipe.response === 'no').length
        },
        B: {
          yes: data.filter(swipe => swipe.room_side === 'B' && swipe.response === 'yes').length,
          no: data.filter(swipe => swipe.room_side === 'B' && swipe.response === 'no').length
        }
      }
    };
    
    res.json(certaintyAnalytics);
  } catch (error) {
    console.error('Error generating user certainty analytics:', error);
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
    
    // Process analytics with certainty metrics
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
      certaintyMetrics: {
        averageCertainty: data.length > 0 ? 
          data.reduce((sum, item) => sum + (item.certainty_percentage || 0), 0) / data.length : 0,
        highCertaintySwipes: data.filter(item => (item.certainty_percentage || 0) >= 75).length,
        mediumCertaintySwipes: data.filter(item => (item.certainty_percentage || 0) >= 50 && (item.certainty_percentage || 0) < 75).length,
        lowCertaintySwipes: data.filter(item => (item.certainty_percentage || 0) < 50).length,
        averageSwipesPerSecond: data.length > 0 ? 
          data.reduce((sum, item) => sum + (item.swipes_per_second || 0), 0) / data.length : 0,
        maxSwipesPerSecondOverall: data.length > 0 ? 
          Math.max(...data.map(item => item.max_swipes_per_second || 0)) : 0
      },
      userCertaintyStats: (() => {
        const userStats = {};
        const uniqueUsers = new Set(data.map(item => item.user_id));
        
        uniqueUsers.forEach(userId => {
          const userSwipes = data.filter(item => item.user_id === userId);
          userStats[userId] = {
            totalSwipes: userSwipes.length,
            averageCertainty: userSwipes.length > 0 ? 
              userSwipes.reduce((sum, swipe) => sum + (swipe.certainty_percentage || 0), 0) / userSwipes.length : 0,
            maxSwipesPerSecond: userSwipes.length > 0 ? 
              Math.max(...userSwipes.map(swipe => swipe.max_swipes_per_second || 0)) : 0
          };
        });
        
        return userStats;
      })(),
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

// Export data as CSV for analysis
app.get('/api/export/csv', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('depth_perception_swipes')
      .select('*')
      .order('timestamp', { ascending: true });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch export data',
        details: error.message 
      });
    }
    
    // Convert to CSV
    const headers = [
      'user_id', 'username', 'room_side', 'swipe_direction', 'response',
      'timestamp', 'melbourne_time', 'session_duration', 'swipes_in_window',
      'swipes_per_second', 'max_swipes_per_second', 'certainty_percentage'
    ];
    
    let csv = headers.join(',') + '\n';
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes in CSV
        return typeof value === 'string' && value.includes(',') ? 
          `"${value.replace(/"/g, '""')}"` : value;
      });
      csv += values.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=depth_perception_data.csv');
    res.send(csv);
    
  } catch (error) {
    console.error('Error exporting CSV:', error);
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
  console.log(`📈 Certainty Analytics: http://localhost:${PORT}/api/certainty/user/[userId]`);
  console.log(`📋 CSV Export: http://localhost:${PORT}/api/export/csv`);
});