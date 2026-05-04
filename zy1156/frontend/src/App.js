import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { 
  ThemeProvider, 
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Snackbar,
  Alert,
  Box,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  UploadFile as UploadIcon,
  Assessment as AssessmentIcon,
  CompareArrows as CompareIcon,
  Description as ReportIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';

import useAppStore from './store/appStore';
import Dashboard from './pages/Dashboard';
import FileUpload from './pages/FileUpload';
import EvaluationPage from './pages/EvaluationPage';
import ComparisonPage from './pages/ComparisonPage';
import ReportPage from './pages/ReportPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

const drawerWidth = 240;

function AppContent() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const notification = useAppStore((state) => state.notification);
  const clearNotification = useAppStore((state) => state.clearNotification);
  const fetchStrategies = useAppStore((state) => state.fetchStrategies);
  const fetchTasks = useAppStore((state) => state.fetchTasks);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchStrategies();
    fetchTasks();
  }, [fetchStrategies, fetchTasks]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawerContent = (
    <Box sx={{ width: drawerWidth }}>
      <Toolbar>
        <IconButton onClick={handleDrawerToggle} sx={{ display: { sm: 'none' } }}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div">
          LLM 上下文评估台
        </Typography>
      </Toolbar>
      <List>
        <ListItem button component={Link} to="/" onClick={() => setMobileOpen(false)}>
          <ListItemIcon><DashboardIcon /></ListItemIcon>
          <ListItemText primary="仪表盘" />
        </ListItem>
        <ListItem button component={Link} to="/upload" onClick={() => setMobileOpen(false)}>
          <ListItemIcon><UploadIcon /></ListItemIcon>
          <ListItemText primary="上传文件" />
        </ListItem>
        <ListItem button component={Link} to="/evaluation" onClick={() => setMobileOpen(false)}>
          <ListItemIcon><AssessmentIcon /></ListItemIcon>
          <ListItemText primary="评估分析" />
        </ListItem>
        <ListItem button component={Link} to="/compare" onClick={() => setMobileOpen(false)}>
          <ListItemIcon><CompareIcon /></ListItemIcon>
          <ListItemText primary="方案对比" />
        </ListItem>
        <ListItem button component={Link} to="/reports" onClick={() => setMobileOpen(false)}>
          <ListItemIcon><ReportIcon /></ListItemIcon>
          <ListItemText primary="报告导出" />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            LLM Context Evaluator
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth 
            },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth 
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<FileUpload />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="/evaluation/:id" element={<EvaluationPage />} />
          <Route path="/compare" element={<ComparisonPage />} />
          <Route path="/reports" element={<ReportPage />} />
        </Routes>
      </Box>

      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={clearNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={clearNotification}
          severity={notification?.type || 'info'}
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
