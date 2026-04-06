import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Image, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [dashboardData, setDashboardData] = useState({
    ongoingSessions: 0,
    todayScans: 0,
    lecturerName: '',
  });
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Week 1');

  const fetchDashboard = useCallback(async (selectedWeek: string) => {
    try {
      // Fetch ALL created sessions count for this lecturer's courses
      let userCoursesQuery = supabase.from('courses').select('id');
      if (user?.id) {
        userCoursesQuery = userCoursesQuery.eq('lecturer_id', user.id);
      }
      const { data: userCourses } = await userCoursesQuery;
        
      let sessionsCount = 0;
      let totalEnrolledAll = 0;
      
      if (userCourses && userCourses.length > 0) {
        const courseIds = userCourses.map(c => c.id);
        
        // Get sessions count
        const { count: sessionCountResult } = await supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact', head: true })
          .in('course_id', courseIds);
        sessionsCount = sessionCountResult || 0;
        
        // Get unique enrolled students across ALL these courses
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('student_id')
          .in('course_id', courseIds);
          
        if (enrollments) {
          const uniqueStudents = new Set(enrollments.map(e => e.student_id));
          totalEnrolledAll = uniqueStudents.size;
        }
      }

      // Extract week number from string "Week 1", etc.
      const weekNumber = parseInt(selectedWeek.replace('Week ', ''), 10);

      // Fetch courses for the list
      let coursesDataQuery = supabase.from('courses').select('id, name, code').limit(5);
      if (user?.id) {
        coursesDataQuery = coursesDataQuery.eq('lecturer_id', user.id);
      }
      const { data: coursesData } = await coursesDataQuery;

      const mappedCourses = await Promise.all((coursesData || []).map(async (c) => {
        // Get enrolled student count for THIS specific course
        const { count: enrolledCount } = await supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', c.id);

        const totalEnrolled = enrolledCount || 0;

        // Find sessions for this course AND this specific week
        const { data: sessions } = await supabase
          .from('attendance_sessions')
          .select('id')
          .eq('course_id', c.id)
          .eq('week', weekNumber);

        let presentCount = 0;

        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map(s => s.id);
          
          // Get all records for these sessions
          const { data: records } = await supabase
            .from('attendance_records')
            .select('status')
            .in('session_id', sessionIds);

          if (records) {
             presentCount = records.filter(r => r.status === 'present').length;
          }
        }

        // Calculate percentage: (present / enrolled in THIS course) * 100
        let calcPercentage = 0;
        if (totalEnrolled > 0) {
            calcPercentage = Math.round((presentCount / totalEnrolled) * 100);
        }
        
        // Determine color based on percentage
        let percentColor = '#22C55E'; // green 71-100%
        if (calcPercentage <= 10) percentColor = '#EF4444'; // red 0-10%
        else if (calcPercentage <= 30) percentColor = '#F97316'; // orange 11-30%
        else if (calcPercentage <= 50) percentColor = '#EAB308'; // yellow 31-50%
        else if (calcPercentage <= 70) percentColor = '#84CC16'; // lime 51-70%

        return {
          id: c.id,
          code: c.code,
          name: c.name,
          percentage: calcPercentage,
          current: presentCount,
          total: totalEnrolled,
          color: percentColor,
          badgeText: `${calcPercentage}% ↑`,
          isWeekBadge: false
        };
      }));

      // Set state
      setDashboardData({
        ongoingSessions: sessionsCount || 0,
        todayScans: totalEnrolledAll,
        lecturerName: user?.name || 'Lecturer', 
      });
      
      setCoursesList(mappedCourses);

    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchDashboard(activeTab);
    setLoading(false);
  }, [fetchDashboard, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard(activeTab);
    setRefreshing(false);
  }, [fetchDashboard, activeTab]);

  useEffect(() => {
    if (!authLoading && !user) {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/auth');
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, router, loadData]);

  const handleSignOut = async () => {
    try {
      await signOut();
      if (router.canDismiss()) router.dismissAll();
      router.replace('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Generate mock bar chart bars for a course
  const renderMockBars = (isWarning: boolean) => {
    const bars = [0.4, 0.7, 0.3, 0.9, 0.6, 0.8, 0.4, 0.5, 0.2, 0.7, 0.5, 0.8, 0.3];
    return (
      <View style={styles.chartRow}>
        <Text style={styles.chartEllipsis}>...</Text>
        <View style={styles.barsContainer}>
          {bars.map((height, i) => {
            let barColor = '#22C55E'; // green 71-100%
            if (height <= 0.1) barColor = '#EF4444'; // red 0-10%
            else if (height <= 0.3) barColor = '#F97316'; // orange 11-30%
            else if (height <= 0.5) barColor = '#EAB308'; // yellow 31-50%
            else if (height <= 0.7) barColor = '#84CC16'; // lime 51-70%
            
            if (i === 2 && isWarning) barColor = '#EF4444'; 
            return (
              <View 
                key={i} 
                style={[
                  styles.chartBar, 
                  { height: height * 24, backgroundColor: barColor }
                ]} 
              />
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        bounces={true} 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        
        {/* Header Section */}
        <View style={[styles.headerBackground, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.headerTop}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIconPlaceholder}>
                <Image source={require('@/assets/images/logo1.png')} style={styles.logoImage} resizeMode="contain" />
              </View>
              <Text style={styles.logoText}>ScanLect</Text>
            </View>
            <View style={styles.headerRightActions}>
              <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
                <IconSymbol ios_icon_name="rectangle.portrait.and.arrow.right" android_material_icon_name="logout" size={20} color="#FFFFFF" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.greetingHeader}>Welcome, {dashboardData.lecturerName}</Text>
        </View>

        <View style={styles.mainContent}>
          <View style={styles.statsContainer}>
            <View style={[styles.statCardBlue, { marginRight: spacing.sm }]}>
              <Text style={styles.statTitle}>Ongoing Sessions</Text>
              <Text style={styles.statValue}>{dashboardData.ongoingSessions}</Text>
              <View style={styles.statWatermark}>
                <IconSymbol ios_icon_name="barcode" android_material_icon_name="qr-code-scanner" size={72} color="rgba(255,255,255,0.15)" />
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.statCardBlue, { marginLeft: spacing.sm }]}
              onPress={() => router.push('/roster')}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
                <Text style={[styles.statTitle, { marginBottom: 0 }]}>Enrolled Students</Text>
                <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={16} color="#DBEAFE" />
              </View>
              <Text style={styles.statValue}>{dashboardData.todayScans}</Text>
              <Text style={{ color: '#DBEAFE', fontSize: 11, marginTop: 4, zIndex: 2, fontWeight: '500' }}>Tap to view roster</Text>
              <View style={styles.statWatermark}>
                <IconSymbol ios_icon_name="chart.bar.doc.horizontal" android_material_icon_name="grid-on" size={72} color="rgba(255,255,255,0.15)" />
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push('/create-session')}
          >
            <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={20} color={colors.textDark} />
            <Text style={styles.primaryActionText}>New Attendance Session</Text>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Attendance Overview</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/(home)/statistics')}>
              <Text style={styles.viewAllText}>View All {'>'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScrollView}
            contentContainerStyle={styles.tabsContainer}
          >
            {Array.from({ length: 14 }, (_, i) => `Week ${i + 1}`).map((week) => (
              <TouchableOpacity
                key={week}
                style={[styles.tabItem, activeTab === week && styles.tabItemActive]}
                onPress={() => setActiveTab(week)}
              >
                <Text style={[styles.tabText, activeTab === week && styles.tabTextActive]}>{week}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading ? (
             <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
          ) : (
            <View style={styles.courseList}>
              {coursesList.map(course => (
                <View key={course.id} style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseTitle} numberOfLines={1}>
                      <Text style={{fontWeight: '700'}}>{course.code}</Text> - {course.name}
                    </Text>
                    <View style={[styles.courseBadge, { backgroundColor: course.color }]}>
                      <Text style={styles.courseBadgeText}>{course.badgeText}</Text>
                    </View>
                  </View>

                  <View style={styles.progressRow}>
                    <Text style={[styles.progressText, { color: course.color }]}>
                      {course.percentage}%
                    </Text>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBarFill, { width: `${course.percentage}%`, backgroundColor: course.color }]} />
                    </View>
                  </View>

                  {renderMockBars(course.isWeekBadge || false)}
                </View>
              ))}
              {coursesList.length === 0 && (
                 <Text style={{ textAlign:'center', color:'#9CA3AF', marginVertical: 20 }}>No courses available.</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.viewRecordsBtn}
            onPress={() => router.push('/export-data')}
          >
            <IconSymbol ios_icon_name="doc.text.fill" android_material_icon_name="description" size={24} color="#10B981" />
            <Text style={styles.viewRecordsText}>View Records (PDF)</Text>
            <IconSymbol ios_icon_name="qrcode.viewfinder" android_material_icon_name="qr-code-scanner" size={24} color="#9CA3AF" />
          </TouchableOpacity>
          
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Increased to account for the new bottom tab bar size
  },
  headerBackground: {
    backgroundColor: '#0F172A',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoIconPlaceholder: {
    width: 36,
    height: 36,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  greetingHeader: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  mainContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  statCardBlue: {
    flex: 1,
    backgroundColor: '#3B82F6', 
    borderRadius: 16,
    padding: spacing.lg,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  statTitle: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.xs,
    zIndex: 2,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    zIndex: 2,
  },
  statWatermark: {
    position: 'absolute',
    bottom: -15,
    right: -10,
    zIndex: 1,
    transform: [{ rotate: '-10deg' }],
  },
  primaryAction: {
    backgroundColor: '#1E40AF',
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  viewAllText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabsScrollView: {
    marginBottom: spacing.lg,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: borderRadius.sm,
    padding: 4,
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabItemActive: {
    backgroundColor: '#1E40AF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  courseList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  courseTitle: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginRight: spacing.sm,
  },
  courseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  courseBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    width: 65,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
  },
  chartEllipsis: {
    color: '#9CA3AF',
    fontSize: 18,
    lineHeight: 18,
    marginRight: spacing.sm,
    marginBottom: 4,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
  },
  chartBar: {
    width: 12,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  viewRecordsBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: spacing.xl,
  },
  viewRecordsText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginLeft: spacing.sm,
  },
});
