import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function ForgotPasswordScreen() {
    const router = useRouter();

    const handleEmailPress = () => {
        Linking.openURL('mailto:attendanceprj@gmail.com');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>



                <View style={styles.header}>
                    <Image
                        source={require('@/assets/images/logo1.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.title}>Password Reset</Text>
                    <Text style={styles.subtitle}>
                        Need to regain access?
                    </Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.iconContainer}>
                        <IconSymbol
                            ios_icon_name="envelope.fill"
                            android_material_icon_name="email"
                            size={40}
                            color={colors.primary}
                        />
                    </View>
                    <Text style={styles.instructionTitle}>Contact Support</Text>
                    <Text style={styles.message}>
                        To get a new password, you must email support. We will help you securely recover your account.
                    </Text>

                    <TouchableOpacity
                        style={styles.emailButton}
                        onPress={handleEmailPress}
                    >
                        <Text style={styles.emailButtonText}>attendanceprj@gmail.com</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.returnButton}
                    onPress={() => router.back()}
                >
                    <Text style={styles.returnButtonText}>Return to Sign In</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        padding: spacing.xl,
        justifyContent: 'center',
    },
    backButton: {
        position: 'absolute',
        top: spacing.xl,
        left: spacing.xl,
        zIndex: 10,
        padding: spacing.xs,
        backgroundColor: colors.card,
        borderRadius: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xxl,
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: spacing.md,
    },
    title: {
        ...typography.h1,
        color: colors.primary,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xl,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: `${colors.primary}15`,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    instructionTitle: {
        ...typography.h3,
        color: colors.text,
        marginBottom: spacing.sm,
        fontWeight: '700',
    },
    message: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: spacing.xl,
    },
    emailButton: {
        backgroundColor: `${colors.primary}10`,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.primary,
        width: '100%',
        alignItems: 'center',
    },
    emailButtonText: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '600',
    },
    returnButton: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    returnButtonText: {
        ...typography.body,
        color: colors.textSecondary,
        fontWeight: '600',
    }
});
