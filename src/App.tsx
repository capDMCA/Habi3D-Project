import { useSessionStore } from './stores/sessionStore';
import AuthScreen from './screens/AuthScreen';
import AdminScreen from './screens/AdminScreen';
import EntryScreen from './screens/EntryScreen';
import ARDemoScreen from './screens/ARDemoScreen';
import UnitSetupScreen from './screens/UnitSetupScreen';
import FurnitureInputScreen from './screens/FurnitureInputScreen';
import DimensionVerificationScreen from './screens/DimensionVerificationScreen';
import PositionMapScreen from './screens/PositionMapScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import RecommendationScreen from './screens/RecommendationScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import './App.css';

export default function App() {
  const currentScreen = useSessionStore((s) => s.currentScreen);

  switch (currentScreen) {
    case 'auth':
      return <AuthScreen />;
    case 'admin':
      return <AdminScreen />;
    case 'entry':
      return <EntryScreen />;
    case 'arDemo':
      return <ARDemoScreen />;
    case 'unitSetup':
      return <UnitSetupScreen />;
    case 'furnitureInput':
      return <FurnitureInputScreen />;
    case 'dimensionVerification':
      return <DimensionVerificationScreen />;
    case 'positionMap':
      return <PositionMapScreen />;
    case 'analysis':
      return <AnalysisScreen />;
    case 'recommendations':
    case 'recommendation':
      return <RecommendationScreen />;
    default:
      return <PlaceholderScreen screenName={currentScreen} />;
  }
}
