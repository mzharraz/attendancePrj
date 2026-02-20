import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Modal, ActivityIndicator, LayoutAnimation, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
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
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <IconSymbol
                        ios_icon_name="chevron.left"
                        android_material_icon_name="chevron-left"
                        size={28}
                        color={colors.text}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Personal Information</Text>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Enter your name"
                                placeholderTextColor={colors.textSecondary}
                                autoCapitalize="words"
                            />
                            <Text style={styles.helperText}>This name will be visible to your students.</Text>
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
                                        size={20}
                                        color={colors.primary}
                                    />
                                    <Text style={styles.addButtonText}>Add Course</Text>
                                </TouchableOpacity>
                            </View>

                            {loadingCourses ? (
                                <ActivityIndicator size="small" color={colors.primary} />
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
                                                            color={colors.textSecondary}
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
                                                            color={colors.error}
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
                animationType="slide"
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
                                    ios_icon_name="xmark"
                                    android_material_icon_name="close"
                                    size={24}
                                    color={colors.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <View style={styles.modalBody}>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Course Code</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={courseCode}
                                        onChangeText={setCourseCode}
                                        placeholder="e.g. CS101"
                                        placeholderTextColor={colors.textSecondary}
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
                                        placeholderTextColor={colors.textSecondary}
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    backButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.text,
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
        ...typography.h3,
        fontSize: 18,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    inputContainer: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.body,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 16,
        color: colors.text,
    },
    helperText: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    buttonContainer: {
        marginTop: spacing.md,
        marginBottom: spacing.xl,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        height: 56,
    },
    saveButtonText: {
        ...typography.body,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Course List Styles
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 4,
    },
    addButtonText: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
    courseList: {
        gap: spacing.sm,
    },
    courseItem: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    courseInfo: {
        flex: 1,
    },
    courseCode: {
        ...typography.body,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 2,
    },
    courseName: {
        ...typography.bodySmall,
        color: colors.text,
    },
    courseActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginLeft: spacing.md,
    },
    actionButton: {
        padding: 8,
    },
    deleteButton: {
        // marginLeft: spacing.xs,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: spacing.sm,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        minHeight: '50%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    modalTitle: {
        ...typography.h3,
        color: colors.text,
    },
    modalBody: {
        gap: spacing.md,
    },
    modalButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        height: 50,
        marginTop: spacing.lg,
    },
});
