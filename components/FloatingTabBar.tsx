import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { useTheme } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

export interface TabBarItem {
  name: string;
  route: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
  containerWidth?: number;
  borderRadius?: number;
  bottomMargin?: number;
}

export default function FloatingTabBar({
  tabs,
}: FloatingTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Improved active tab detection with better path matching
  const activeTabIndex = React.useMemo(() => {
    let bestMatch = -1;
    let bestMatchScore = 0;

    tabs.forEach((tab, index) => {
      let score = 0;
      const routeStr = typeof tab.route === 'string' ? tab.route : tab.route.pathname;

      if (pathname === tab.route || pathname + '/' === tab.route || pathname === routeStr + '/') {
        score = 100;
      }
      else if (pathname.startsWith(routeStr) && routeStr !== '/') {
        score = 80;
      }
      else if (pathname.includes(tab.name)) {
        score = 60;
      }
      else if (routeStr.includes('/(tabs)/') && pathname.includes(routeStr.split('/(tabs)/')[1])) {
        score = 40;
      }

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatch = index;
      }
    });

    return bestMatch >= 0 ? bestMatch : 0;
  }, [pathname, tabs]);

  const handleTabPress = (route: Href) => {
    router.push(route);
  };

  const handleCreateSessionPress = () => {
    router.push('/create-session');
  };

  const getIconColor = (index: number) => {
      return activeTabIndex === index ? '#1E40AF' : '#9CA3AF';
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBarContent}>
        
        {/* Left Tab: Dashboard */}
        {tabs.length > 0 && (
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => handleTabPress(tabs[0].route)}
            activeOpacity={0.7}
          >
            <IconSymbol
              android_material_icon_name={tabs[0].icon}
              ios_icon_name={tabs[0].icon}
              size={26}
              color={getIconColor(0)}
            />
            <Text style={[styles.tabLabel, { color: getIconColor(0) }]}>
              {tabs[0].label}
            </Text>
          </TouchableOpacity>
        )}

        {/* Center Tab: Create Session (Giant QR Button) */}
        <View style={styles.centerTabWrapper}>
          <TouchableOpacity
            style={styles.centerButton}
            onPress={handleCreateSessionPress}
            activeOpacity={0.9}
          >
            <IconSymbol
              android_material_icon_name="qr-code-scanner"
              ios_icon_name="qrcode.viewfinder"
              size={32}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Right Tab: Profile */}
        {tabs.length > 1 && (
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => handleTabPress(tabs[1].route)}
            activeOpacity={0.7}
          >
            <IconSymbol
              android_material_icon_name={tabs[1].icon}
              ios_icon_name={tabs[1].icon}
              size={26}
              color={getIconColor(1)}
            />
            <Text style={[styles.tabLabel, { color: getIconColor(1) }]}>
              {tabs[1].label}
            </Text>
          </TouchableOpacity>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10, // For Android shadow
  },
  tabBarContent: {
    flexDirection: 'row',
    height: 65,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E40AF', // Dark blue
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32, // Floating upwards over the bar
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#F3F4F6', // Gives it a cutout effect against the background padding
  },
});
