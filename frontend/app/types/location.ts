export interface GoogleLocation {
  name: string;
  title: string;
  address: string;
  locationId: string;
  accountId: string;
  primaryCategory?: string | null;
  additionalCategories?: string[];
}
