import { useSessionStore } from './stores/sessionStore';
import EntryScreen from './screens/EntryScreen';
import AuthScreen from './screens/AuthScreen';
import FurnitureInputScreen from './screens/FurnitureInputScreen';
import PositionMapScreen from './screens/PositionMapScreen';
import WorkspaceScreen from './screens/WorkspaceScreen';
import ThreeDPreviewScreen from './screens/ThreeDPreviewScreen';
import ReportScreen from './screens/ReportScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import './App.css';

export default function App() {
  const currentScreen = useSessionStore((s) => s.currentScreen);

  switch (currentScreen) {
    case 'entry':
      return <EntryScreen />;
    case 'auth':
      return <AuthScreen />;
    case 'furnitureInput':
      return <FurnitureInputScreen />;
    case 'positionMap':
      return <PositionMapScreen />;
    case 'workspace':
    case 'analysis':
    case 'recommendations':
    case 'recommendation':
      return <WorkspaceScreen />;
    case 'threeDPreview':
      return <ThreeDPreviewScreen />;
    case 'report':
      return <ReportScreen />;
    default:
      return <PlaceholderScreen screenName={currentScreen} />;
  }
}
