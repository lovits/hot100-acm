#include <stdio.h>
#include <stdlib.h>

static void rotate(int** matrix, int matrixSize, int *matrixColSize)
{
    int i, j;
    for (i = 0; i < matrixSize / 2; i++) {
        int col_size = matrixColSize[i];
        int low = i, high = col_size - i - 1;
        for (j = low; j < high; j++) {
            int tmp = matrix[i][j];
            matrix[i][j] = matrix[col_size - 1 - j][i];
            matrix[col_size - 1 - j][i] = matrix[matrixSize - 1 - i][col_size - 1 - j];
            matrix[matrixSize - 1 - i][col_size - 1 - j] = matrix[j][matrixSize - 1 - i];
            matrix[j][matrixSize - 1 - i] = tmp;
        }
    }
}
