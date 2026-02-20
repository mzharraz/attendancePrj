import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';

type Course = {
    id: string;
    name: string;
    code: string;
};

export default function ExportDataScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            if (!user) return;

            const { data, error } = await supabase
                .from('courses')
                .select('id, name, code')
                .eq('lecturer_id', user.id)
                .order('name');

            if (error) {
                throw error;
            }

            setCourses(data || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
            Alert.alert('Error', 'Failed to load courses');
        } finally {
            setLoading(false);
        }
    };

    const handleCourseSelect = (course: Course) => {
        Alert.alert(
            'Export Data',
            `Export data for ${course.name} (${course.code})?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Export',
                    onPress: () => {
                        // TODO: Implement actual export logic
                        console.log(`Exporting data for course: ${course.id}`);
                        Alert.alert('Success', `Data for ${course.code} exported successfully!`);
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: Course }) => (
        <TouchableOpacity style={styles.courseCard} onPress={() => handleCourseSelect(item)}>
            <View style={styles.iconContainer}>
                <IconSymbol
                    ios_icon_name="book.fill"
                    android_material_icon_name="book"
                    size={24}
                    color={colors.primary}
                />
            </View>
            <View style={styles.courseInfo}>
                <Text style={styles.courseName}>{item.name}</Text>
                <Text style={styles.courseCode}>{item.code}</Text>
            </View>
            <IconSymbol
                ios_icon_name="square.and.arrow.up"
                android_material_icon_name="file-upload"
                size={20}
                color={colors.textSecondary}
            />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <IconSymbol
                        ios_icon_name="chevron.left"
                        android_material_icon_name="arrow-back"
                        size={24}
                        color={colors.text}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Export Data</Text>
                <View style={{ width: 24 }} />
            </View>

            <Text style={styles.subtitle}>Select a course to export attendance records</Text>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : courses.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No courses found.</Text>
                </View>
            ) : (
                <FlatList
                    data={courses}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: Platform.OS === 'android' ? 20 : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        // Removed border to be cleaner as requested
    },
    backButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.text,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.text,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        padding: spacing.lg,
        paddingBottom: spacing.sm,
    },
    listContent: {
        padding: spacing.lg,
    },
    courseCard: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        backgroundColor: colors.highlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    courseInfo: {
        flex: 1,
    },
    courseName: {
        ...typography.body,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    courseCode: {
        ...typography.caption,
        color: colors.textSecondary,
    },
});
