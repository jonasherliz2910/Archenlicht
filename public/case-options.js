export const caseLabel = configuration => configuration?.magsafe ? 'Tough-Hülle · MagSafe-kompatibel' : 'Tough-Standardhülle';
export const casePrice = (brand, configuration) => (configuration.kind === 'custom' ? brand.customPrice : brand.fixedPrice) + (configuration.magsafe ? brand.magsafeSurcharge : 0);
export const plannedCasePrice = (brand, configuration) => (configuration.kind === 'custom' ? brand.plannedCustomPrice ?? brand.customPrice : brand.plannedFixedPrice ?? brand.fixedPrice) + (configuration.magsafe ? brand.magsafeSurcharge : 0);
export const caseAvailable = (variant, configuration) => Boolean(configuration.magsafe ? variant?.magsafe_available : variant?.available);
