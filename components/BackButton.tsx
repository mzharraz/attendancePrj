import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, typography } from '@/styles/commonStyles';

interface BackButtonProps {
    onPress?: () => void;
    label?: string;
    style?: ViewStyle;
    textStyle?: TextStyle;
    color?: string;
}

export function BackButton({
    onPress,
    label = 'Back',
    style,
    textStyle,
    color = colors.text
}: BackButtonProps) {
    const router = useRouter();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            if (router.canGoBack()) {
                router.back();
            } else {
                // Fallback or explicit handling if needed, usually router.back() is safe
                router.replace('/');
            }
        }
    };

    return (
        <TouchableOpacity
            style={[styles.backButton, style]}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={color}
            />
            <Text style={[styles.backButtonText, { color }, textStyle]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs, // Add touch target hit area
        paddingRight: spacing.sm,
    },
    backButtonText: {
        ...typography.body,
        fontWeight: '500', // Matches typical expectations better than default
    },
});
