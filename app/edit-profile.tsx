import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Modal, ActivityIndicator, LayoutAnimation, UIManager, Pressable } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LoadingButton } from '@/components/LoadingButton';
import { supabase } from '@/lib/supabase';

interface Course {
    id: string;
    name: string;
    code: string;
}

export default function EditProfileScreen() {
    const { user, updateProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    const [name, setName] = useState(user?.name || '');
    const [isLoading, setIsLoading] = useState(false);

    // Course management state
    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [courseName, setCourseName] = useState('');
    const [courseCode, setCourseCode] = useState('');
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [savingCourse, setSavingCourse] = useState(false);

    useEffect(() => {
        if (user?.role === 'lecturer') {
            fetchCourses();
        }
    }, [user]);

    const fetchCourses = async () => {
        if (!user) return;
        setLoadingCourses(true);
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .eq('lecturer_id', user.id)
                .order('code', { ascending: true });

            if (error) throw error;
            setCourses(data || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
            Alert.alert('Error', 'Failed to load courses');
        } finally {
            setLoadingCourses(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Name cannot be empty');
            return;
        }

        try {
            setIsLoading(true);
            await updateProfile(name);
            Alert.alert('Success', 'Profile updated successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (course?: Course) => {
        if (course) {
            setEditingCourse(course);
            setCourseName(course.name);
            setCourseCode(course.code);
        } else {
            setEditingCourse(null);
            setCourseName('');
            setCourseCode('');
        }
        setModalVisible(true);
    };

    const handleSaveCourse = async () => {
        if (!courseName.trim() || !courseCode.trim()) {
            Alert.alert('Error', 'Please fill in all course details');
            return;
        }

        if (!user) return;

        setSavingCourse(true);
        try {
            if (editingCourse) {
                // Update existing course
                const { error } = await supabase
                    .from('courses')
                    .update({ name: courseName.trim(), code: courseCode.trim() })
                    .eq('id', editingCourse.id)
                    .select(); // Add select to verify update

                if (error) throw error;
            } else {
                // Create new course
                const { error } = await supabase
                    .from('courses')
                    .insert({
                        lecturer_id: user.id,
                        name: courseName.trim(),
                        code: courseCode.trim()
                    })
                    .select(); // Add select to verify insert

                if (error) throw error;
            }

            setModalVisible(false);
            fetchCourses(); // Refresh list
        } catch (error: any) {
            console.error('Error saving course:', error);
            Alert.alert('Error', `Failed to save course: ${error.message || 'Unknown error'}`);
        } finally {
            setSavingCourse(false);
        }
    };

    const handleDeleteCourse = (courseId: string) => {
        Alert.alert(
            'Delete Course',
            'Are you sure you want to delete this course? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('courses')
                                .delete()
                                .eq('id', courseId);

                            if (error) throw error;

                            // Animate removal
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setCourses(prev => prev.filter(c => c.id !== courseId));

                            // Also fetch to ensure sync
                            fetchCourses();
                        } catch (error: any) {
                            console.error('Error deleting course:', error);
                            Alert.alert('Error', `Failed to delete course: ${error.message || 'Unknown error'}`);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Dark Blue Header Section */}
            <View style={[styles.headerBackground, { paddingTop: Math.max(insets.top, 16) }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={32} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <View style={{ width: 32 }} />
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView 
                    bounces={true} 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.content}
                >
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Personal Information</Text>
                        <View style={styles.card}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Full Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Enter your name"
                                    placeholderTextColor="#9CA3AF"
                                    autoCapitalize="words"
                                />
                                <Text style={styles.helperText}>This name will be visible to your students.</Text>
                            </View>
                        </View>
                    </View>

                    {user?.role === 'lecturer' && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>My Courses</Text>
                                <TouchableOpacity onPress={() => handleOpenModal()} style={styles.addButton}>
                                    <IconSymbol
                                        ios_icon_name="plus"
                                        android_material_icon_name="add"
                                        size={16}
                                        color="#1E40AF"
                                    />
                                    <Text style={styles.addButtonText}>Add Course</Text>
                                </TouchableOpacity>
                            </View>

                            {loadingCourses ? (
                                <ActivityIndicator size="small" color="#1E40AF" style={{ marginTop: spacing.md }} />
                            ) : (
                                <View style={styles.courseList}>
                                    {courses.length === 0 ? (
                                        <Text style={styles.emptyText}>No courses added yet.</Text>
                                    ) : (
                                        courses.map((course) => (
                                            <View key={course.id} style={styles.courseItem}>
                                                <View style={styles.courseInfo}>
                                                    <Text style={styles.courseCode}>{course.code}</Text>
                                                    <Text style={styles.courseName}>{course.name}</Text>
                                                </View>
                                                <View style={styles.courseActions}>
                                                    <TouchableOpacity
                                                        onPress={() => handleOpenModal(course)}
                                                        style={styles.actionButton}
                                                    >
                                                        <IconSymbol
                                                            ios_icon_name="pencil"
                                                            android_material_icon_name="edit"
                                                            size={20}
                                                            color="#6B7280"
                                                        />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => handleDeleteCourse(course.id)}
                                                        style={[styles.actionButton, styles.deleteButton]}
                                                    >
                                                        <IconSymbol
                                                            ios_icon_name="trash"
                                                            android_material_icon_name="delete"
                                                            size={20}
                                                            color="#EF4444"
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.buttonContainer}>
                        <LoadingButton
                            title="Save Changes"
                            onPress={handleSave}
                            loading={isLoading}
                            style={styles.saveButton}
                            textStyle={styles.saveButtonText}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingCourse ? 'Edit Course' : 'Add New Course'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <IconSymbol
                                    ios_icon_name="xmark.circle.fill"
                                    android_material_icon_name="close"
                                    size={24}
                                    color="#9CA3AF"
                                />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.modalBody}>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Course Code</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={courseCode}
                                        onChangeText={setCourseCode}
                                        placeholder="e.g. CS101"
                                        placeholderTextColor="#9CA3AF"
                                        autoCapitalize="characters"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Course Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={courseName}
                                        onChangeText={setCourseName}
                                        placeholder="e.g. Introduction to Computer Science"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>

                                <LoadingButton
                                    title={editingCourse ? 'Update Course' : 'Add Course'}
                                    onPress={handleSaveCourse}
                                    loading={savingCourse}
                                    style={styles.modalButton}
                                    textStyle={styles.saveButtonText}
                                />
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
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
    content: {
        padding: spacing.lg,
        paddingBottom: 40,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    card: {
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
    inputContainer: {
        marginBottom: spacing.sm,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 16,
        color: '#1F2937',
    },
    helperText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: spacing.xs,
    },
    buttonContainer: {
        marginTop: spacing.md,
        marginBottom: spacing.xl,
    },
    saveButton: {
        backgroundColor: '#1E40AF',
        borderRadius: borderRadius.md,
        paddingVertical: 14,
        height: 56,
        shadowColor: '#1E40AF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    // Course List Styles
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    addButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E40AF',
        marginLeft: 4,
    },
    courseList: {
        gap: spacing.md,
    },
    courseItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    courseInfo: {
        flex: 1,
    },
    courseCode: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 2,
    },
    courseName: {
        fontSize: 13,
        color: '#6B7280',
    },
    courseActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginLeft: spacing.md,
    },
    actionButton: {
        padding: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    deleteButton: {
        backgroundColor: '#FEE2E2',
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: spacing.sm,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: spacing.xl,
        paddingBottom: spacing.xl * 2,
        minHeight: '50%',
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    modalBody: {
        gap: spacing.md,
    },
    modalButton: {
        backgroundColor: '#1E40AF',
        borderRadius: borderRadius.md,
        height: 50,
        marginTop: spacing.lg,
        shadowColor: '#1E40AF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
});
