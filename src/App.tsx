import { useSessionStore } from './stores/sessionStore';
import EntryScreen from './screens/EntryScreen';
import ARDemoScreen from './screens/ARDemoScreen';
import PreSurveyScreen from './screens/PreSurveyScreen';
import UnitSetupScreen from './screens/UnitSetupScreen';
import FurnitureInputScreen from './screens/FurnitureInputScreen';
import DimensionVerificationScreen from './screens/DimensionVerificationScreen';
import PositionMapScreen from './screens/PositionMapScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import './App.css';

export default function App() {
  const currentScreen = useSessionStore((s) => s.currentScreen);

  switch (currentScreen) {
    case 'entry':
      return <EntryScreen />;
    case 'arDemo':
      return <ARDemoScreen />;
    case 'preSurvey':
      return <PreSurveyScreen />;
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
    default:
      return <PlaceholderScreen screenName={currentScreen} />;
  }
}
