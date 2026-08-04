import { useSessionStore } from './stores/sessionStore';
import SessionStartScreen from './screens/SessionStartScreen';
import EntryScreen from './screens/EntryScreen';
import ARDemoScreen from './screens/ARDemoScreen';
import FurnitureInputScreen from './screens/FurnitureInputScreen';
import PositionMapScreen from './screens/PositionMapScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import RecommendationScreen from './screens/RecommendationScreen';
import ReportScreen from './screens/ReportScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import './App.css';

export default function App() {
  const currentScreen = useSessionStore((s) => s.currentScreen);

  switch (currentScreen) {
    case 'sessionStart':
      return <SessionStartScreen />;
    case 'entry':
      return <EntryScreen />;
    case 'arDemo':
      return <ARDemoScreen />;
    case 'furnitureInput':
      return <FurnitureInputScreen />;
    case 'positionMap':
      return <PositionMapScreen />;
    case 'analysis':
      return <AnalysisScreen />;
    case 'recommendations':
    case 'recommendation':
      return <RecommendationScreen />;
    case 'report':
      return <ReportScreen />;
    default:
      return <PlaceholderScreen screenName={currentScreen} />;
  }
}
