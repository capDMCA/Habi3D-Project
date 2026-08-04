import { useSessionStore } from './stores/sessionStore';
import UnitSetupScreen from './screens/UnitSetupScreen';
import EntryScreen from './screens/EntryScreen';
import ARDemoScreen from './screens/ARDemoScreen';
import FurnitureInputScreen from './screens/FurnitureInputScreen';
import PositionMapScreen from './screens/PositionMapScreen';
import WorkspaceScreen from './screens/WorkspaceScreen';
import ReportScreen from './screens/ReportScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import './App.css';

export default function App() {
  const currentScreen = useSessionStore((s) => s.currentScreen);

  switch (currentScreen) {
    case 'unitSetup':
      return <UnitSetupScreen />;
    case 'entry':
      return <EntryScreen />;
    case 'arDemo':
      return <ARDemoScreen />;
    case 'furnitureInput':
      return <FurnitureInputScreen />;
    case 'positionMap':
      return <PositionMapScreen />;
    case 'analysis':
    case 'recommendations':
    case 'recommendation':
      return <WorkspaceScreen />;
    case 'report':
      return <ReportScreen />;
    default:
      return <PlaceholderScreen screenName={currentScreen} />;
  }
}
