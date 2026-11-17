#include <stdio.h>
#include <stdlib.h>


/**
 * Return an array of arrays of size *returnSize.
 * The sizes of the arrays are returned as *returnColumnSizes array.
 * Note: Both returned array and *returnColumnSizes array must be malloced, assume caller calls free().
 */
int** generate(int numRows, int *returnSize, int** returnColumnSizes)
{
    int i, j;
    int **triangle = malloc(numRows * sizeof(int *));
    *returnColumnSizes = malloc(numRows * sizeof(int *));
    for (i = 0; i < numRows; i++) {
        int num = i + 1;
        (*returnColumnSizes)[i] = num;
        triangle[i] = malloc(num * sizeof(int));
        triangle[i][0] = 1;
        triangle[i][num - 1] = 1;
        for (j = 1; j <= num - 2; j++) {
            triangle[i][j] = triangle[i - 1][j - 1] + triangle[i - 1][j];
        }
    }
    *returnSize = numRows;
    return triangle;
}
