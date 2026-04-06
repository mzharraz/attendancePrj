import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Modal, Pressable, Alert, Platform } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Course {
    id: string;
    name: string;
    code: string;
}

interface EnrolledStudent {
    id: string;
    name: string;
    student_id: string;
    enrolled_at: string;
}

export default function RosterScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [showCourseModal, setShowCourseModal] = useState(false);
    
    const [students, setStudents] = useState<EnrolledStudent[]>([]);

    useEffect(() => {
        if (user) {
            fetchCourses();
        }
    }, [user]);

    useEffect(() => {
        if (selectedCourse) {
            fetchEnrolledStudents();
        }
    }, [selectedCourse]);

    // Re-fetch students whenever this screen gains focus (e.g. after scanning)
    useFocusEffect(
        useCallback(() => {
            if (selectedCourse) {
                fetchEnrolledStudents();
            }
        }, [selectedCourse])
    );

    const fetchCourses = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('courses')
                .select('id, name, code')
                .eq('lecturer_id', user!.id)
                .order('name');

            if (error) throw error;

            if (data && data.length > 0) {
                setCourses(data);
                setSelectedCourse(data[0]);
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEnrolledStudents = async () => {
        if (!selectedCourse) return;
        try {
            setLoading(true);
            
            // Step 1: Get enrollment records for this course
            const { data: enrollments, error: enrollError } = await supabase
                .from('course_enrollments')
                .select('student_id, enrolled_at')
                .eq('course_id', selectedCourse.id)
                .order('enrolled_at', { ascending: true });

            if (enrollError) throw enrollError;

            if (enrollments && enrollments.length > 0) {
                // Step 2: Get user details for all enrolled student IDs
                const studentIds = enrollments.map((e: any) => e.student_id);
                console.log('[Roster] Found enrollments, student IDs:', studentIds);
                
                const { data: users, error: userError } = await supabase
                    .from('user')
                    .select('id, name, student_id')
                    .in('id', studentIds);

                console.log('[Roster] User query result:', { users, userError });
                if (userError) throw userError;

                // Build a lookup map for quick access
                const userMap = new Map<string, any>();
                (users || []).forEach((u: any) => userMap.set(u.id, u));

                const mappedStudents: EnrolledStudent[] = enrollments
                    .map((record: any) => {
                        const u = userMap.get(record.student_id);
                        return {
                            id: u?.id || record.student_id,
                            name: u?.name || 'Unknown',
                            student_id: u?.student_id || 'N/A',
                            enrolled_at: record.enrolled_at
                        };
                    });
                
                // Sort alphabetically
                mappedStudents.sort((a, b) => a.name.localeCompare(b.name));
                setStudents(mappedStudents);
            } else {
                setStudents([]);
            }

        } catch (error) {
            console.error('Error fetching enrolled students:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnenrollStudent = async (studentId: string, studentName: string) => {
        const executeUnenroll = async () => {
            try {
                setLoading(true);
                const { error } = await supabase
                    .from('course_enrollments')
                    .delete()
                    .eq('course_id', selectedCourse!.id)
                    .eq('student_id', studentId);

                if (error) throw error;
                fetchEnrolledStudents();
            } catch (error) {
                console.error('Error unenrolling:', error);
                Alert.alert('Error', 'Failed to un-enroll student.');
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Remove ${studentName} from this course?`)) executeUnenroll();
        } else {
            Alert.alert(
                'Unenroll Student',
                `Are you sure you want to remove ${studentName} from the roster?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: executeUnenroll }
                ]
            );
        }
    };

    const handleResetCourse = () => {
        const executeReset = async () => {
            try {
                setLoading(true);
                // Also optionally delete attendance records for this course to fully reset, 
                // but let's stick to just wiping enrollments for Option 1 requirements.
                const { error } = await supabase
                    .from('course_enrollments')
                    .delete()
                    .eq('course_id', selectedCourse!.id);

                if (error) throw error;
                fetchEnrolledStudents();
                Alert.alert('Success', 'Course enrollments have been reset.');
            } catch (error) {
                console.error('Error resetting course:', error);
                Alert.alert('Error', 'Failed to reset course.');
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('WARNING: This will remove ALL students from this course roster. Are you sure?')) executeReset();
        } else {
            Alert.alert(
                'Reset Course Roster',
                'WARNING: This will remove ALL students from this course roster. They will have to scan again to register. Are you sure?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset Course', style: 'destructive', onPress: executeReset }
                ]
            );
        }
    };

    const renderCourseSelector = () => (
        <TouchableOpacity
            style={styles.courseCard}
            onPress={() => setShowCourseModal(true)}
        >
            <View style={styles.courseHeader}>
                <View>
                    <Text style={styles.selectorLabel}>Course Filter</Text>
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

    const renderStudentItem = ({ item }: { item: EnrolledStudent }) => (
        <View style={styles.studentRow}>
            <View style={styles.studentInfo}>
                <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.studentId}>{item.student_id}</Text>
            </View>
            <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleUnenrollStudent(item.id, item.name)}
            >
                <IconSymbol ios_icon_name="minus.circle.fill" android_material_icon_name="remove-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={[styles.headerBackground, { paddingTop: Math.max(insets.top, 16) }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={32} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Course Roster</Text>
                    <View style={{ width: 32 }} />
                </View>
            </View>

            <ScrollView 
                bounces={true} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {renderCourseSelector()}

                {loading ? (
                    <ActivityIndicator size="large" color="#1E40AF" style={styles.loader} />
                ) : (
                    <View style={styles.rosterCard}>
                        <View style={styles.rosterHeader}>
                            <Text style={styles.rosterTitle}>Enrolled Students ({students.length})</Text>
                            {students.length > 0 && (
                                <TouchableOpacity onPress={handleResetCourse} style={styles.resetButton}>
                                    <IconSymbol ios_icon_name="arrow.triangle.2.circlepath" android_material_icon_name="autorenew" size={16} color="#DC2626" />
                                    <Text style={styles.resetButtonText}>Reset Course</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {students.length === 0 ? (
                            <View style={styles.emptyState}>
                                <IconSymbol ios_icon_name="person.3.sequence.fill" android_material_icon_name="groups" size={48} color="#9CA3AF" />
                                <Text style={styles.emptyStateTitle}>No Students Enrolled</Text>
                                <Text style={styles.emptyStateDesc}>
                                    Students will appear here once they scan their first attendance for this course.
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={students}
                                renderItem={renderStudentItem}
                                keyExtractor={(item) => item.id}
                                scrollEnabled={false}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                            />
                        )}
                    </View>
                )}
            </ScrollView>

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
        paddingBottom: 100,
    },
    loader: {
        marginTop: spacing.xl,
    },

    // Course Selector
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

    // Roster Card
    rosterCard: {
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
    },
    rosterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        marginBottom: spacing.xs,
    },
    rosterTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        gap: 4,
    },
    resetButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },

    // Student List
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
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    studentId: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 2,
    },
    actionButton: {
        padding: spacing.xs,
    },
    separator: {
        height: 1,
        backgroundColor: '#F3F4F6',
    },

    // Empty State
    emptyState: {
        paddingVertical: spacing.xxl,
        alignItems: 'center',
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: spacing.md,
    },
    emptyStateDesc: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: spacing.sm,
        paddingHorizontal: spacing.lg,
    },

    // Modal Overrides
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
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
    modalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalItemSelected: {
        backgroundColor: '#EFF6FF',
    },
    modalItemText: {
        fontSize: 15,
        color: '#4B5563',
    },
    modalItemTextSelected: {
        color: '#1E40AF',
        fontWeight: '600',
    }
});
