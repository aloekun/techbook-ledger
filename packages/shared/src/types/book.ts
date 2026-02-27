export interface BookData {
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly publisher: string;
  readonly price: number;
  readonly publicationDate: string;
  readonly pageCount: number;
  readonly sourceUrl: string;
}

export interface BookRecord extends BookData {
  readonly registrationDate: string;
}
