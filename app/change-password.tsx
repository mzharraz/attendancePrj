import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LoadingButton } from '@/components/LoadingButton';

export default function ChangePasswordScreen() {
    const { updateProfile, signOut } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const handleSave = async () => {
        setErrors({});
        let hasError = false;
        const newErrors: { [key: string]: string } = {};

        if (!oldPassword) {
            newErrors.oldPassword = 'Required';
            hasError = true;
        }
        if (!newPassword) {
            newErrors.newPassword = 'Required';
            hasError = true;
        } else if (newPassword.length < 6) {
            newErrors.newPassword = 'Password must be at least 6 characters';
            hasError = true;
        }
        
        if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
            hasError = true;
        }

        if (hasError) {
            setErrors(newErrors);
            return;
        }

        try {
            setIsLoading(true);
            await updateProfile({
                old_password: oldPassword,
                password: newPassword,
            });
            
            Alert.alert('Success', 'Password updated successfully. Please log in with your new password.', [
                { 
                    text: 'OK', 
                    onPress: async () => {
                        await signOut();
                        if (router.canDismiss()) {
                            router.dismissAll();
                        }
                        router.replace('/auth');
                    } 
                }
            ]);
        } catch (error: any) {
            console.error('Change password error:', error);
            const msg = error.message || 'Failed to update password';
            
            if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('incorrect')) {
                setErrors({ oldPassword: msg });
            } else {
                setErrors({ general: msg });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={[styles.headerBackground, { paddingTop: Math.max(insets.top, 16) }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={32} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Change Password</Text>
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
                        <Text style={styles.sectionTitle}>Security</Text>
                        <Text style={styles.subtitle}>Create a new strong password for your account.</Text>
                        
                        {errors.general && (
                            <View style={[styles.errorContainer, { marginBottom: spacing.md }]}>
                                <Text style={styles.errorText}>{errors.general}</Text>
                            </View>
                        )}
                        
                        <View style={styles.card}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Current Password <Text style={{ color: 'red' }}>*</Text></Text>
                                {errors.oldPassword && <Text style={styles.inlineErrorText}>{errors.oldPassword}</Text>}
                                <TextInput
                                    style={[styles.input, errors.oldPassword ? styles.inputError : null]}
                                    value={oldPassword}
                                    onChangeText={(text) => {
                                        setOldPassword(text);
                                        if (errors.oldPassword) setErrors(prev => ({ ...prev, oldPassword: '' }));
                                    }}
                                    placeholder="Enter current password"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>New Password <Text style={{ color: 'red' }}>*</Text></Text>
                                {errors.newPassword && <Text style={styles.inlineErrorText}>{errors.newPassword}</Text>}
                                <TextInput
                                    style={[styles.input, errors.newPassword ? styles.inputError : null]}
                                    value={newPassword}
                                    onChangeText={(text) => {
                                        setNewPassword(text);
                                        if (errors.newPassword) setErrors(prev => ({ ...prev, newPassword: '' }));
                                    }}
                                    placeholder="Enter new password"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Confirm New Password <Text style={{ color: 'red' }}>*</Text></Text>
                                {errors.confirmPassword && <Text style={styles.inlineErrorText}>{errors.confirmPassword}</Text>}
                                <TextInput
                                    style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
                                    value={confirmPassword}
                                    onChangeText={(text) => {
                                        setConfirmPassword(text);
                                        if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                                    }}
                                    placeholder="Confirm new password"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.buttonContainer}>
                        <LoadingButton
                            title="Update Password"
                            onPress={handleSave}
                            loading={isLoading}
                            style={styles.saveButton}
                            textStyle={styles.saveButtonText}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: spacing.md,
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
        marginBottom: spacing.md,
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
    buttonContainer: {
        marginTop: spacing.xs,
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
    errorContainer: {
        marginTop: spacing.sm,
        padding: spacing.sm,
        backgroundColor: '#FEF2F2',
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
        fontWeight: '500',
    },
    inlineErrorText: {
        color: '#DC2626',
        fontSize: 12,
        fontWeight: '500',
        marginBottom: spacing.xs,
    },
    inputError: {
        borderColor: '#FCA5A5',
        backgroundColor: '#FEF2F2',
    },
});
