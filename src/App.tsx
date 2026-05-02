import { useSessionStore } from './stores/sessionStore';
import EntryScreen from './screens/EntryScreen';
import PreSurveyScreen from './screens/PreSurveyScreen';
import UnitSetupScreen from './screens/UnitSetupScreen';
import FurnitureInputScreen from './screens/FurnitureInputScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import './App.css';

export default function App() {
  const currentScreen = useSessionStore((s) => s.currentScreen);

  switch (currentScreen) {
    case 'entry':
      return <EntryScreen />;
    case 'preSurvey':
      return <PreSurveyScreen />;
    case 'unitSetup':
      return <UnitSetupScreen />;
    case 'furnitureInput':
      return <FurnitureInputScreen />;
    default:
      return <PlaceholderScreen screenName={currentScreen} />;
  }
}
