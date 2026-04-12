import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Modal, Pressable, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface Course {
    id: string;
    name: string;
    code: string;
}

interface SessionData {
    id: string;
    date: string;
    time: string;
    attendance: StudentAttendance[];
}

interface StudentAttendance {
    student_id: string;
    name: string;
    student_number: string; // Matric number
    status: string; // 'present', 'absent', etc.
    scan_time: string | null;
}

export default function StatisticsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);

    // Selection State
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedWeek, setSelectedWeek] = useState<number>(1);
    const [showCourseModal, setShowCourseModal] = useState(false);

    // Status Modal State
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<{ sessionId: string; studentId: string; name: string; currentStatus: string } | null>(null);

    // Data State
    const [sessionsList, setSessionsList] = useState<SessionData[]>([]);
    const [sessionFound, setSessionFound] = useState<boolean | null>(null); // null = loading/init, true, false

    // 1. Fetch Courses when user is available
    useEffect(() => {
        if (user?.id) {
            fetchCourses();
        }
    }, [user?.id]);

    // 2. Fetch Attendance when Course or Week changes
    useEffect(() => {
        if (selectedCourse) {
            fetchSessionAndAttendance();
        }
    }, [selectedCourse, selectedWeek]);

    const fetchCourses = async () => {
        if (!user?.id) return;
        
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('courses')
                .select('id, name, code')
                .eq('lecturer_id', user.id)
                .order('name');

            if (error) throw error;

            if (data && data.length > 0) {
                setCourses(data);
                setSelectedCourse(data[0]); // Default to first course
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSessionAndAttendance = async () => {
        if (!selectedCourse) return;

        setLoading(true);
        setSessionsList([]);
        setSessionFound(null);

        try {
            // Step 0: Fetch ONLY enrolled students for this course
            const { data: enrolledStudentsData, error: studentsError } = await supabase
                .from('course_enrollments')
                .select(`
                    user:student_id (
                        id,
                        name,
                        student_id
                    )
                `)
                .eq('course_id', selectedCourse.id);

            if (studentsError) throw studentsError;

            // Map the joined data back to a flat array format
            const allStudents = enrolledStudentsData
                ?.map(enrollment => enrollment.user)
                ?.filter(user => user !== null) as any[] || [];

            // Step A: Find ALL sessions for the selected Course + Week
            const { data: sessions, error: sessionError } = await supabase
                .from('attendance_sessions')
                .select('id, date, time')
                .eq('course_id', selectedCourse.id)
                .eq('week', selectedWeek)
                .order('date', { ascending: true })
                .order('time', { ascending: true });

            if (sessionError) throw sessionError;

            if (!sessions || sessions.length === 0) {
                setSessionFound(false);
                setLoading(false);
                return;
            }

            setSessionFound(true);

            // Step B: For each session, get records and merge with all students
            const sessionsWithData: SessionData[] = [];

            for (const session of sessions) {
                const { data: records, error: recordsError } = await supabase
                    .from('attendance_records')
                    .select(`
                        status,
                        scan_time,
                        student_id
                    `)
                    .eq('session_id', session.id);

                if (recordsError) throw recordsError;

                // Create a map of existing records for quick lookup
                const attendanceMap = new Map();
                records.forEach((r: any) => {
                    attendanceMap.set(r.student_id, r);
                });

                // Merge all students with attendance records
                const formattedList: StudentAttendance[] = (allStudents || []).map(student => {
                    const record = attendanceMap.get(student.id);
                    return {
                        student_id: student.id,
                        name: student.name || 'Unknown',
                        student_number: student.student_id || 'N/A',
                        status: record ? record.status : 'absent',
                        scan_time: record ? record.scan_time : null,
                    };
                });

                // Sort by name
                formattedList.sort((a, b) => a.name.localeCompare(b.name));

                sessionsWithData.push({
                    id: session.id,
                    date: session.date,
                    time: session.time,
                    attendance: formattedList,
                });
            }

            setSessionsList(sessionsWithData);

        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        const executeDelete = async () => {
            try {
                setLoading(true);
                const { error } = await supabase
                    .from('attendance_sessions')
                    .delete()
                    .eq('id', sessionId);

                if (error) throw error;

                // Refresh data
                fetchSessionAndAttendance();
            } catch (error) {
                console.error('Error deleting session:', error);
                Alert.alert('Error', 'Failed to delete session');
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            const confirmDelete = window.confirm('Are you sure you want to delete this session? This will remove all attendance records for this session.');
            if (confirmDelete) {
                executeDelete();
            }
        } else {
            Alert.alert(
                'Delete Session',
                'Are you sure you want to delete this session? This will remove all attendance records for this session.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: executeDelete,
                    },
                ]
            );
        }
    };

    const handleUpdateAttendance = async (newStatus: string) => {
        if (!selectedRecord) return;
        
        try {
            setLoading(true);
            setStatusModalVisible(false);

            // Check if an attendance record already exists
            const { data: existingRecords, error: fetchError } = await supabase
                .from('attendance_records')
                .select('id')
                .eq('session_id', selectedRecord.sessionId)
                .eq('student_id', selectedRecord.studentId);

            if (fetchError) throw fetchError;

            if (existingRecords && existingRecords.length > 0) {
                // Update
                const { error: updateError } = await supabase
                    .from('attendance_records')
                    .update({ status: newStatus })
                    .eq('id', existingRecords[0].id);
                    
                if (updateError) throw updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('attendance_records')
                    .insert({
                        session_id: selectedRecord.sessionId,
                        student_id: selectedRecord.studentId,
                        status: newStatus,
                        scan_time: new Date().toISOString()
                    });
                    
                if (insertError) throw insertError;
            }

            // Refresh data
            fetchSessionAndAttendance();
        } catch (error) {
            console.error('Error updating attendance:', error);
            Alert.alert('Error', 'Failed to update attendance status.');
            setLoading(false);
        }
    };

    // --- Render Components ---

    const renderCourseSelector = () => (
        <TouchableOpacity
            style={styles.courseCard}
            onPress={() => setShowCourseModal(true)}
        >
            <View style={styles.courseHeader}>
                <View>
                    <Text style={styles.selectorLabel}>Course</Text>
                    {selectedCourse ? (
                        <Text style={styles.courseTitle}>
                            <Text style={{fontWeight: '700'}}>{selectedCourse.code}</Text>
                            <Text> - {selectedCourse.name}</Text>
                        </Text>
                    ) : (
                        <Text style={styles.courseTitle}>Select a Course</Text>
                    )}
                </View>
                <IconSymbol ios_icon_name="chevron.up.chevron.down" android_material_icon_name="unfold-more" size={24} color="#9CA3AF" />
            </View>
        </TouchableOpacity>
    );

    const renderWeekSelector = () => (
        <View style={styles.weekSelectorContainer}>
            <View style={styles.tabsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.weekScrollContent}
                >
                    {Array.from({ length: 14 }, (_, i) => i + 1).map((week) => (
                        <TouchableOpacity
                            key={week}
                            style={[
                                styles.tabItem,
                                selectedWeek === week && styles.tabItemActive
                            ]}
                            onPress={() => setSelectedWeek(week)}
                        >
                            <Text style={[
                                styles.tabText,
                                selectedWeek === week && styles.tabTextActive
                            ]}>
                                Week {week}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'present': return '#10B981'; // Green matching dashboard course progress
            case 'absent': return '#EF4444'; // Red
            case 'late': return '#F59E0B'; // Orange
            default: return '#9CA3AF'; // Gray
        }
    };

    const renderStudentItem = ({ item, sessionId }: { item: StudentAttendance, sessionId?: string }) => {
        const statusColor = getStatusColor(item.status);

        const handleStatusPress = () => {
            if (!sessionId) return;
            setSelectedRecord({
                sessionId,
                studentId: item.student_id,
                name: item.name,
                currentStatus: item.status
            });
            setStatusModalVisible(true);
        };

        return (
            <View style={styles.studentRow}>
                <View style={styles.studentInfo}>
                    <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.studentId}>{item.student_number}</Text>
                </View>
                <View style={styles.statusContainer}>
                    <TouchableOpacity 
                        style={[styles.statusBadge, { backgroundColor: statusColor }]}
                        onPress={handleStatusPress}
                    >
                        <Text style={[styles.statusText, { color: '#FFFFFF' }]}>{item.status.toUpperCase()}</Text>
                    </TouchableOpacity>
                    {item.scan_time ? (
                        <Text style={styles.timeText}>
                            {new Date(item.scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    ) : (
                        <Text style={styles.timeText}>--:--</Text>
                    )}
                </View>
            </View>
        );
    };

    const renderContent = () => {
        if (loading && !sessionFound) {
            return <ActivityIndicator size="large" color="#1E40AF" style={styles.loader} />;
        }

        if (sessionFound === false) {
            return (
                <View style={styles.emptyContainer}>
                    <IconSymbol
                        ios_icon_name="calendar.badge.minus"
                        android_material_icon_name="event-busy"
                        size={48}
                        color="#9CA3AF"
                    />
                    <Text style={styles.emptyText}>No sessions found</Text>
                    <Text style={styles.emptySubText}>
                        There are no class sessions created for Week {selectedWeek} yet.
                    </Text>
                </View>
            );
        }

        return (
            <View>
                {sessionsList.map((session) => (
                    <View key={session.id} style={styles.sessionCard}>
                        <View style={styles.sessionHeader}>
                            <View>
                                <Text style={styles.sessionTitle}>
                                    {new Date(session.date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                                </Text>
                                <Text style={styles.sessionTimeTime}>
                                    {session.time.substring(0, 5)} {/* HH:MM */}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => handleDeleteSession(session.id)}
                                style={styles.deleteButton}
                            >
                                <IconSymbol
                                    ios_icon_name="trash"
                                    android_material_icon_name="delete"
                                    size={20}
                                    color="#EF4444"
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.listContainer}>
                            <View style={styles.listHeader}>
                                <Text style={styles.listSectionTitle}>Student Attendance ({session.attendance.length})</Text>
                            </View>

                            {session.attendance.length === 0 ? (
                                <Text style={styles.emptyListText}>No students have been enrolled.</Text>
                            ) : (
                                <FlatList
                                    data={session.attendance}
                                    renderItem={({ item }) => renderStudentItem({ item, sessionId: session.id })}
                                    keyExtractor={(item) => item.student_id}
                                    scrollEnabled={false}
                                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                                />
                            )}
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* We hide the default stack header and build our own dark blue one */}
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Dark Blue Header Section */}
            <View style={[styles.headerBackground, { paddingTop: Math.max(insets.top, 16) }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={32} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Attendance Statistics</Text>
                    <View style={{ width: 32 }} /> {/* Empty view for flex balancing with back button */}
                </View>
            </View>

            <ScrollView 
                bounces={true} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {renderCourseSelector()}
                {renderWeekSelector()}
                {renderContent()}
            </ScrollView>

            {/* Status Selection Modal */}
            <Modal
                visible={statusModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setStatusModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setStatusModalVisible(false)}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitleText}>Update Status</Text>
                                {selectedRecord && (
                                    <Text style={styles.modalSubtitleText}>{selectedRecord.name}</Text>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                                <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="close" size={24} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                        
                        {['present', 'absent'].map((statusOption) => (
                            <TouchableOpacity
                                key={statusOption}
                                style={[
                                    styles.modalItem,
                                    selectedRecord?.currentStatus === statusOption && styles.modalItemSelected
                                ]}
                                onPress={() => handleUpdateAttendance(statusOption)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[
                                        styles.statusDot, 
                                        { backgroundColor: getStatusColor(statusOption) }
                                    ]} />
                                    <Text style={[
                                        styles.modalItemText,
                                        selectedRecord?.currentStatus === statusOption && styles.modalItemTextSelected,
                                        { textTransform: 'capitalize' }
                                    ]}>
                                        {statusOption}
                                    </Text>
                                </View>
                                {selectedRecord?.currentStatus === statusOption && (
                                    <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={20} color="#1E40AF" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Modal>

            {/* Course Selection Modal */}
            <Modal
                visible={showCourseModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCourseModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowCourseModal(false)}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitleText}>Select Course</Text>
                            <TouchableOpacity onPress={() => setShowCourseModal(false)}>
                                <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="close" size={24} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={courses}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.modalItem,
                                        selectedCourse?.id === item.id && styles.modalItemSelected
                                    ]}
                                    onPress={() => {
                                        setSelectedCourse(item);
                                        setShowCourseModal(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.modalItemText,
                                        selectedCourse?.id === item.id && styles.modalItemTextSelected
                                    ]}>
                                        <Text style={{fontWeight: '700'}}>{item.code}</Text>
                                        <Text> - {item.name}</Text>
                                    </Text>
                                    {selectedCourse?.id === item.id && (
                                        <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={20} color="#1E40AF" />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    headerBackground: {
        backgroundColor: '#0F172A',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.md,
    },
    backButton: {
        paddingVertical: 5,
        paddingRight: 10,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: 100, // Safe padding above bottom tab bar
    },
    loader: {
        marginTop: spacing.xl,
    },

    // Course Selector (Card Style like Index)
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
        marginBottom: spacing.lg,
    },
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectorLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
        marginBottom: 2,
    },
    courseTitle: {
        fontSize: 15,
        color: '#374151',
    },

    // Week Selector (Segmented UI like Index)
    weekSelectorContainer: {
        marginBottom: spacing.xl,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#E5E7EB',
        borderRadius: borderRadius.sm,
        padding: 4,
    },
    weekScrollContent: {
        alignItems: 'center',
    },
    tabItem: {
        paddingVertical: 8,
        paddingHorizontal: 16,
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

    // Sessions (Card Style)
    sessionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: spacing.lg,
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sessionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    sessionTimeTime: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    deleteButton: {
        padding: spacing.xs,
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
    },

    // Internal Student List
    listContainer: {
        marginTop: spacing.xs,
    },
    listHeader: {
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingBottom: spacing.sm,
        marginBottom: spacing.sm,
    },
    listSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptyListText: {
        paddingVertical: spacing.md,
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 13,
    },
    studentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    studentInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    studentName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    studentId: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    statusContainer: {
        alignItems: 'flex-end',
        flexShrink: 0,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 4,
        alignItems: 'center',
        minWidth: 72,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    timeText: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    separator: {
        height: 1,
        backgroundColor: '#F3F4F6',
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        marginTop: spacing.md,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginTop: spacing.md,
        textAlign: 'center',
    },
    emptySubText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: spacing.sm,
        lineHeight: 20,
    },

    // Modal Overrides
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)', // Dark blue tint for overlay
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '70%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitleText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    modalSubtitleText: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: spacing.sm,
    },
    modalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalItemSelected: {
        backgroundColor: '#EFF6FF', // Light blue highlight
    },
    modalItemText: {
        fontSize: 15,
        color: '#374151',
    },
    modalItemTextSelected: {
        fontWeight: '700',
        color: '#1E40AF',
    },
});
